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

为 `spec-graph-bootstrap` 引入两档刷新模型：`incremental`（显式 `--incremental` operator escape hatch / expert opt-in 触发，委托 provider 原生增量命令）与 `full`（默认）。**速度目标仅用于 clean single-repo 显式 opt-in 场景**：把 single-repo `commit` 后的 canonical readiness 刷新耗时从 ~25 秒降到 ~3-5 秒（实测在 U4 benchmark 中核验并写回 validation doc）。`--all-repos` 多仓 bootstrap 保持 `DEFAULT_REFRESH_MODE_ALL_REPOS=full` 不变，多仓优化属独立 validation 计划。

**Rollout 策略**：本计划交付**incremental flag-gated operator escape hatch / expert opt-in**；U4 benchmark 是 **opt-in 正确性基线**，**不** 自动触发默认切换，也不把增量刷新定位为普通 workflow 用户默认路径。Default 切换到 incremental 需要独立的 rollout plan（含连续增量链 A→B→C→D 测试 / rename benchmark / parser degradation fuzz 等更宽 gate）来支撑。本计划只覆盖 bootstrap 自身的两档模型，不捆绑其他 workflow 的治理或披露改动。

### At a Glance

| 维度 | 说明 |
|---|---|
| **问题** | commit 后 `.spec-first/graph/graph-facts.json` 立即 stale，脱困路径目前仅有 ~25 秒全量重跑 |
| **核心机制** | bootstrap 按 fingerprint 决策 `incremental`（委托 `gitnexus analyze` / `code-review-graph update --base`）vs `full`；incremental 失败自动 fallback 到 full |
| **已闭环的实施级 bug** | R6 `last_indexed_commit` carry-forward 避免原子 rewrite 擦除；R6 `^[0-9a-f]{40}$` 格式校验防 argv injection；R7 dirty worktree 强制降级 full（无 opt-in，避免索引 / base ref 错位） |
| **验收 gate**（U4） | A→B 差分对照在 disposable temp clone 跑，per-provider mandatory pass matrix 全绿 → **incremental flag-gated operator opt-in 上线**；**default 切换需独立更宽 rollout plan**（A→B→C→D 链 / rename / parser degradation 等） |
| **速度目标范围** | single-repo only；`--all-repos` 仍走 full 默认，不在本计划速度承诺内 |
| **实施前必做** | A4 协调（`2026-05-09-003` 串行 / 并行 ack；**A3 sanity check 已在 planning 阶段通过，无需重跑**）+ U0 provider extraction proof spike（U1/U2 前必须通过） |
| **显式 Scope 剥离** | dirty incremental opt-in / `spec-work` 披露契约 / 统一 redaction helper / `--all-repos` 多仓默认切换 → 全部 follow-up plan |
| **回滚成本** | 本计划不切默认；出问题时停止使用 `--incremental` 且默认仍为 full。未来 default-switch follow-up 才涉及单行常量回滚。 |

---

## Target Operator

本计划的首批使用者是熟悉 `.spec-first/graph/` artifacts、能阅读 `provider-status.json` / validation doc、且愿意承担显式诊断责任的 spec-first maintainer / power user。允许场景限于 **clean single-repo** 的手动 post-commit graph refresh、一次性 benchmark / validation、以及 provider 行为调查；operator 必须串行运行同一仓库的 graph bootstrap。该能力不面向普通 onboarding 用户、CI 默认路径、dirty worktree、`--all-repos` default switch、并发 bootstrap 或无法阅读诊断 artifact 的 workflow 用户。

文档分层规则：README / README.zh-CN / 核心用户手册只保留一句 expert opt-in 提示（默认仍为 full，clean single-repo operator 可显式尝试 `--incremental`）；fallback 处理、issue 上报字段、redaction checklist、benchmark caveats 放到 graph-bootstrap 专项 validation / troubleshooting 文档或 graph provider consumption contract，不抬到 onboarding 主路径。

---

## Problem Frame

`2026-05-09-003-feat-graph-bootstrap-fast-reuse-plan.md` 已铺好 `bootstrap_fingerprint` / `worktree_status_hash` 失效基础设施，`2026-05-12-002-feat-gitnexus-refresh-trigger-policy-plan.md` 已把 refresh trigger policy 收敛为"freshness-check 自动、refresh 显式、repair preview"三节点契约。核心缺口是：**commit 之后 canonical `.spec-first/graph/graph-facts.json` 的 `source_revision` 立刻 stale，现在唯一脱困路径是花 ~25 秒全量重跑**。

通过 context7 查询两个 provider 的官方文档已确认：GitNexus `analyze` 内部自动判断增量 / 全量，`--force` 强制全量；code-review-graph 提供独立的 `update [--base <ref>]` 增量命令和 `build` 全量命令。spec-first 不需要自建增量算法，只要在 bootstrap 脚本里按 fingerprint 决策 incremental vs full、委托 provider 原生命令、失败时 fallback。

---

## Requirements

- R1. `spec-graph-bootstrap` 必须支持两档刷新模式：`incremental`（显式 `--incremental` flag 触发的 operator opt-in）与 `full`（默认、显式 `--force` / `--full`、fingerprint 非 repo-snapshot 部分变化、dirty worktree 强制降级、或 `requires_clean_full_refresh=true`）。默认值由两个独立常量控制：`DEFAULT_REFRESH_MODE_SINGLE_REPO` 与 `DEFAULT_REFRESH_MODE_ALL_REPOS`，初始均为 `full`；本计划交付 incremental flag-gated operator opt-in，**不**自动切换默认（rollout plan 独立）。**运行时分流规则**：
  - CLI flag `--all-repos` 存在 → 走 `DEFAULT_REFRESH_MODE_ALL_REPOS`。
  - 否则 → 走 `DEFAULT_REFRESH_MODE_SINGLE_REPO`。
  - `workspace-graph-targets.v1` 是 advisory summary，不参与本分流判定。
  - 测试矩阵（U2/U3）：(a) 直接 `--all-repos` 走 ALL_REPOS 常量；(b) 无 flag 走 SINGLE_REPO 常量。
  - **Child-scoped invocation 协议（env var `SPEC_FIRST_ALL_REPOS_SCOPE=1` + parent-workspace candidate mode 的 child propagation 规则与对应 (b)/(c)/(d) 测试矩阵）已 Deferred to Follow-Up Work**，与 `--all-repos` 多仓 default switch 验证一同处理；本计划范围内 ALL_REPOS 分支永远走 `full`，child propagation 不影响 opt-in correctness。
- R2. `incremental` 模式必须委托给 provider 原生增量接口：GitNexus 使用 `analyze`（无 `--force`），code-review-graph 使用 `update --base <last_indexed_commit>`。
- R3. `full` 模式保持现有行为不变：GitNexus 使用 `analyze --force`，code-review-graph 使用 `build`。
- R4. fingerprint 的非 repo-snapshot 部分（`spec_first.*`、`provider_projection.*`、`provider.*`）任一变化时必须强制 `full`。
- R5. incremental 命令失败时必须自动降级到 full 一次，按两种 outcome 记录不同 reason_code：
  - **Fallback 成功（incremental 失败 → full 重跑成功）**：`readiness_source=incremental-fallback-full`，`reason_code=incremental-refresh-failed-fallback-full`，`refresh_mode=incremental-fallback-full`。
  - **Fallback 失败（incremental 失败 → full 重跑也失败）**：`workflow_mode=degraded-fallback`，`reason_code=incremental-and-full-failed`，per-provider `refresh_mode=failed`，当前 attempt 的 `status=failed` / `graph_ready=false` / `query_ready=false`；上一轮成功的 canonical freshness 指针与 normalized envelopes 按"Artifact 保留矩阵"保留，不能让失败的当前 attempt 看起来 query-ready。
- R6. `last_indexed_commit` 的**来源、写入时机与合法性**（U2 Approach 复用本条，不重复展开）：
  - **来源（消费时）**：per-provider `.spec-first/providers/<id>/status.json.last_indexed_commit`（上一次 readiness 三级证据全过 + clean worktree 时写入）；**不是** aggregate `graph-facts.json.source_revision`。
  - **可信 provenance（消费前）**：只有 prior per-provider status 同时满足以下条件，`last_indexed_commit` 才可作为 incremental base：`schema_version="provider-status.v1"`、`graph_ready=true`、`query_ready=true`、`repo_snapshot.worktree_dirty=false`、`repo_snapshot.source_revision == last_indexed_commit`、`bootstrap_fingerprint.repo_snapshot.source_revision == last_indexed_commit`。任一不满足即降级 full，`reason_code=incremental-base-status-untrusted`。这保证 base SHA 来自上一轮 clean 成功 readiness，而不是失败/dirty/手写 status。
  - **写入时机（dirty-aware + carry-forward）**：当前 `write_provider_status()` 用 `jq -n | write_file_atomic` 原子重写整个 status.json。本计划必须**先读旧 status.json** 捕获 `$prior_last_indexed_commit` / `$prior_requires_clean_full_refresh`，最终字段 emit 表达式：
    - **`last_indexed_commit`**：`if (graph_ready and query_ready and worktree_dirty == false) then <current_HEAD_sha> else $prior_last_indexed_commit end`——只有 **clean worktree + readiness 三级证据全过** 才推进；否则保留旧值（transient 失败不擦除，dirty 场景不污染）。
    - **`requires_clean_full_refresh`**（**新字段**）：`if ((worktree_dirty == true and (refresh_mode == "incremental" or refresh_mode == "full")) or provider_command_may_have_touched_native_storage_and_failed) then true else if (worktree_dirty == false and refresh_mode == "full" and graph_ready and query_ready) then false else $prior_requires_clean_full_refresh end`——dirty 跑任何刷新、或 bootstrap/update 命令失败且可能已触碰 provider native storage 时都置 `true`；只有 clean worktree + 完成 full + readiness 通过才清除。**死锁自动 reset**：若 `requires_clean_full_refresh=true` 且当前 full 也失败（`provider_command_may_have_touched_native_storage_and_failed=true`），则 `requires_clean_full_refresh` 保持 `true`（carry-forward）；若 full 失败但 **未** 触碰 native storage（`provider_command_may_have_touched_native_storage_and_failed=false`，例如网络超时、进程被 kill），则 `requires_clean_full_refresh` 保持旧值不变，**不**额外置 `true`，避免无关失败叠加死锁。若用户遭遇持续死锁（provider native storage 损坏），`spec-first doctor` 输出必须提示：`requires_clean_full_refresh=true` 且连续 full 失败时，手动删除 per-provider status.json 可重置状态（R11 文档要求同步）。
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
  - dirty 任何刷新 → 不发布正常 ready/fresh canonical graph facts；当前 dirty attempt 的 machine-readable 状态固定为 `workflow_mode=blocked` + `overall_status=action-required` + `reason_code=dirty-refresh-non-canonical`，canonical freshness 指针沿用上一轮 clean 成功值，避免 downstream 误读为当前 HEAD 的 clean readiness
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
  - **派生路径**：aggregate writer（`bootstrap-providers.sh` L1904-1957 的 graph-facts 段）用 `$providers | map({(.provider): .refresh_mode}) | add` 从 per-provider status 聚合；per-provider `provider-status.v1.refresh_mode` 始终 emit（`skipped` / `cold-run` 场景也填 `full`），保证 aggregate map 键完整。
  - per-provider `provider-status.v1.refresh_mode` 仍为单值，是 truth source；aggregate map 仅供概览。Consumer 需要精确判断时回读 per-provider status，不新增 `refresh_mode_summary` 便利字段。
- R11. 文档/契约/测试同步：`docs/contracts/graph-provider-consumption.md` 补 truth table 与 downstream 使用策略；`docs/contracts/graph-evidence-policy.md` Refresh Trigger Policy 表下方加**一行两档刷新直接相关的 usage note**（见 Scope Boundaries 边界）；`README.md` / `README.zh-CN.md` / `docs/05-用户手册/` 只保留 Target Operator 定义的 expert opt-in 一句话边界；fallback 处理与 redaction checklist 下沉到 graph-bootstrap 专项 validation / troubleshooting 或 consumption contract；`CHANGELOG.md` 按仓库格式登记；contract tests 覆盖 fingerprint 决策矩阵、fallback 路径、artifact 保留与字段/枚举向后兼容。

---

## Assumptions

- A1. 用户关心 commit 后的刷新体验，不是首次 cold run 耗时。**[待验证] 此 premise 需在 rollout 后补录用户反馈或频率数据加以支撑。**
- A2. GitNexus `analyze` 的内部增量判断是可信的；本计划不自行判断文件变更集。
- A3. `code-review-graph update --base <commit>` 在 pinned 2.3.3 版本下可用且与 `build` 在当前仓库语法覆盖范围内近似等价。**Planning 阶段已跑过 `uvx code-review-graph@2.3.3 update --help`，实测输出（2026-05-12 捕获）**：

  ```text
  usage: code-review-graph update [-h] [--base BASE] [--repo REPO]
                                  [--skip-flows] [--skip-postprocess]
                                  [--data-dir DATA_DIR]
  ```

  结论：`update` subcommand 存在、`--base <ref>` 参数存在、无需额外 flag 即可触发增量路径。实施时 PR 描述引用此结论即可，不必重跑；仅在 CRG pin 升级或 CLI 行为变化时需在当次 PR 中复跑并更新 A3。若后续发现 `update --base` 实际语义与 `build` 在本仓库覆盖范围不等价，走 `2026-05-09-005-fix-code-review-graph-uvx-pin` 升级或只对 GitNexus 启用 incremental。
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
- **Secret redaction 边界（tracked docs / issue 禁 raw logs）**：本计划不新增统一 redaction helper，`.spec-first/providers/<id>/raw/*.log` 仍是本地诊断 artifact；但任何 tracked docs（尤其 `docs/validation/**`、README / 用户手册、PR/issue 模板）都**禁止**粘贴 provider 原始 stdout/stderr、未脱敏 URL 或完整 raw log。U4 validation 只记录脱敏命令元数据和结果摘要（provider、command kind、package pin/hash、exit code、duration、readiness_source、reason_code、artifact path、anchor diff 摘要）；issue 上报只包含 `reason_code`、provider、`fallback_from_incremental` 是否出现、发生频率、人工脱敏摘录。最小人工脱敏清单：token / API key、credentialed URL、Authorization/Header/Cookie、私有 registry URL、内网主机名、用户名路径片段。统一 redaction helper 覆盖本地 log / diagnostic JSON mirror surface 仍作为独立 security plan 处理。
- **Log redaction debt 与 argv injection 是正交关切**：R6 的 40-hex 校验只治理本计划新增的 `--base <sha>` argv position，不缓解 provider stdout/stderr 泄露 credential 的风险。
- **incremental 新增 argv position 攻击面**：`--base <sha>` 携带 `.spec-first/providers/<id>/status.json.last_indexed_commit` 值，属于新增 user-influenced 攻击面，由 R6 的 40-hex 格式校验治理——这是本计划**显式闭环**的新攻击面，与上条 log redaction debt 性质不同（前者是本计划引入所以必须治理，后者是预先存在的现状延续）。
- 不捆绑其他 workflow 的治理或披露改动：`spec-work` completion 披露契约属于独立计划。`graph-evidence-policy.md` 本计划**只允许添加一行两档刷新直接相关的 usage note**（post-commit 刷新建议），不做 broader policy 细化（后者属独立计划）。

### Deferred to Follow-Up Work

- 跨 session fast-path 命中率 metrics / observability dashboard。
- `--all-repos` 多仓场景 incremental default switch 的正式验证；本计划保持 `DEFAULT_REFRESH_MODE_ALL_REPOS=full`，直到独立多仓 validation 完成。
- 连续增量链与 silent partial drift 的默认切换 gate：A→B→C→D 多步 benchmark、rename / parser degradation fuzz、以及是否需要 durable counter rotation / forced full cadence，统一放入 default-switch follow-up plan；本计划不新增 `incremental_run_count`。
- **`SPEC_FIRST_ALL_REPOS_SCOPE` env var + parent-workspace candidate mode 的 child-scoped invocation 协议**（含 (b) child env 走 ALL_REPOS / (c) child 无 env 走 SINGLE_REPO / (d) parent-workspace live resolver candidate mode 走 ALL_REPOS 的测试矩阵 + PowerShell `$env:SPEC_FIRST_ALL_REPOS_SCOPE` parity）一并并入上一条 multi-repo default switch validation。本计划范围内 ALL_REPOS=full 不变，child propagation 不影响 opt-in correctness；env-driven 协议落地时同时评审 SEC-001 提的 trust-boundary 措施（reason_code 区分 flag-driven vs env-driven 等）。
- Repo-scoped bootstrap concurrency guard（含 lock / stale-lock reclaim / doctor cleanup / non-mutating concurrent exit）属于独立并发治理计划；本计划只在 Target Operator / docs 中声明不要并发运行同一仓库的 graph bootstrap。
- 其他 provider 的增量接口探测策略。
- 基于 semantic commit 自动推荐 `--force`。
- runtime mirror drift 修复（直接跑 `spec-first init --claude && spec-first init --codex` 即可，不入本计划）。
- `spec-work` completion 输出披露契约 —— 属于 spec-work 的独立改进。
- **统一 log / diagnostic redaction helper**（覆盖现有 `analyze.log` / `build.log` / `status.log` / `query.log`、本计划新增的 `update.log` / `fallback-analyze.log` / `fallback-build.log`、`provider-status.v1.command_results[].diagnostic`、顶层 `diagnostics`、aggregate / report diagnostic mirrors）—— 属独立 security plan（标题待定；security backlog 中追踪）。本计划只禁止 raw provider diagnostics 进入 tracked docs / issues。

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
- `DEFAULT_REFRESH_MODE_SINGLE_REPO` 与 `DEFAULT_REFRESH_MODE_ALL_REPOS` 是脚本顶部**两个独立常量**，初始均为 `full`；本计划范围内**不**自动切换默认（U4 benchmark 是 opt-in 正确性基线）；future default 切换由独立 follow-up rollout plan 承载，届时才可用单行常量 PR 切换 / 回滚。本计划内的回滚动作只是停止使用 `--incremental`。

---

## Open Questions

### Resolved During Planning

- GitNexus `analyze` 增量需要额外 flag？否，文档表明内部自动。
- CRG `update --base` 的 ref 从哪里取？从 per-provider `.spec-first/providers/code-review-graph/status.json.last_indexed_commit`（上一次 `graph_ready=true` 且 `query_ready=true` 成功时写入）；不是 aggregate `graph-facts.json.source_revision`。不存在/非祖先/未记录 → 走 full（R6）。
- Readiness 三级证据 incremental 下是否仍必要？必要。

### Deferred to Implementation

- `provider_reuse_decision()` 与新 `resolve_refresh_mode()` 合并或独立：按代码清晰度决定。
- benchmark 差异阈值：Flow / community count tolerance 实测后写入 validation doc；node/edge equivalence、readiness_source、duration ratio 和 absolute duration gates 按 U4 执行。
- placeholder sentinel 形式：推荐 ASCII-only 字符串（如 `__SPEC_FIRST_LAST_INDEXED_COMMIT__`），由实施者确认不与现有 template token 冲突即可。

### P0 Blocker（实施前必须 resolve，在 PR 描述里 ack）

**2026-05-09-003 fast-reuse 落地状态协调**：SKILL.md L210 仍写 "This phase does not skip provider commands"，表明未落地。两个计划是**串行**（本计划先 → fast-reuse 后续合并 reuse 分支）还是**并行**（指定 `resolve_refresh_mode` 函数 ownership 与合并 PR 顺序）需显式决定。默认假设串行；采用默认只需 PR 描述标注 "Assumed serial with 2026-05-09-003"。

**Enforcement (U1 Pre-flight checklist 必填项，缺失即 block merge)**：U1 PR 描述必须包含以下两条 statement 之一：(a) `Assumed serial with 2026-05-09-003`，或 (b) `Parallel with 2026-05-09-003; resolve_refresh_mode ownership: <this plan | fast-reuse plan>`。Reviewer 在 review 时验证该 statement 存在，否则要求补充后才允许 merge。

> CRG 2.3.3 `update --base` 可用性核验见 A3；属于 sanity check，不作为独立 P0 blocker。

### Deferred from 2026-05-13 doc-review

> 本子段为 spec-doc-review 在 2026-05-13 round 1 产出的待决事项。每条 entry 包含 reviewer 来源、原始 evidence 引用与推荐 fix；实施前由计划作者逐条决策（接受 / 拒绝 / 改写）。
> 2026-05-13 Auto-resolve B 后，active plan 以 Requirements / Implementation Units / Risks 为准；本历史子段中早先标记为 Applied 的 R7a counter、repo-scoped lock、`refresh_mode_summary`、连续 3 次 fallback 规则均已被后续收敛决策 supersede。

#### P1 deferred entries

- **ADV-001 / drift mitigation 与 A1 自相矛盾**（adversarial）— **Superseded by 2026-05-13 Auto-resolve B**：早先选择的 R7a `incremental_run_count` counter rotation 已移出本计划，改放 default-switch follow-up；active mitigation 是 U0 proof + U4 单步 opt-in benchmark + 默认 full + repeated-chain 明确未验证。
- **ADV-002 / 确定性 incremental 失败让 opt-in 用户比 status quo 更慢**（adversarial）— **Superseded by 2026-05-13 Auto-resolve B**：早先"连续 3 次 fallback"责任规则已收紧为任一 observed `fallback_from_incremental=true` 即停用 `--incremental`，调查后再显式重试；issue 只上报脱敏摘要，不附 raw logs。
- **ADV-003 / U4 benchmark 只测首次增量、不测稳态 N 次链**（adversarial）— **Superseded by 2026-05-13 Auto-resolve B**：多步链漂移不再由 R7a counter 声称兜底；A→B→C→D / rename / parser degradation fuzz 和 durable counter rotation 一并移入 default-switch follow-up。
- **PL-001 / A1 premise 缺证据**（product-lens）— **Applied B 2026-05-13 doc-review walk-through**：在 A1 旁加"[待验证]"注记，要求 rollout 后补录用户反馈或频率数据；Summary 25s→3-5s 目标保留为设计目标而非已验证承诺。原始推荐：在 Problem Frame 段补入 (a) `.spec-first/graph/` 历史 artifacts 反推的近 N 周 `$spec-graph-bootstrap` 触发频率与平均耗时；(b) 用户 complaint / dogfooding 记录；或 (c) 若 per-commit 触发非真实使用模式，明确补 A1' 列出哪些 workflow 节点会触发 bootstrap，让 25s 暴露面可计算。
- **PL-002 / 问题框架与交付物错位**（product-lens）— **Applied B 2026-05-13 doc-review walk-through**：与 PL-001 合并处理，A1 加注记已足够；Summary 保持现状，接受 25s→3-5s 作为目标而非已交付承诺，Summary 中 Rollout 策略段已明确 expert opt-in 定位。原始推荐：二选一：(a) Summary 主目标改写为 "为 expert operator 提供 `--incremental` escape hatch + benchmark 等价性证明"；或 (b) 把本计划与 default switch follow-up 合并成分阶段计划。
- **SEC-001 / `SPEC_FIRST_ALL_REPOS_SCOPE` env var 可被注入**（security）。任何能向 bootstrap 进程注入 env 的攻击者（恶意 CI 配置、`.env` 注入、父进程污染）都可强制 single-repo 调用走 ALL_REPOS 分支。推荐：(a) bootstrap 在读取该 env 时记录来源到 reason_code（区分 `flag-driven` vs `env-driven` 分流），(b) 文档明确说明该 env 只能由 spec-first 自身的 `--all-repos` 父进程设置，外部 CI 不应直接设置；default switch 后该 env 的 trust boundary 应再次评审。
- **SG-001 / R1 env 传播协议超出本计划核心目标**（scope-guardian）— **Applied 2026-05-13 doc-review walk-through**：R1 已 trim 为只保留 CLI flag 两档分流；`SPEC_FIRST_ALL_REPOS_SCOPE` env var + parent-workspace candidate mode 的 (b)/(c)/(d) 测试矩阵已移入 `Deferred to Follow-Up Work`，与 `--all-repos default switch` 一并处理；U2 Test scenarios / U3 Verification 同步 trim。SEC-001 的 trust-boundary 措施挂钩在该 follow-up 评审阶段。
- **COH-005 / R10 `refresh_mode_summary` 计算规则在 all-failed 边界歧义**（coherence）— **N/A 2026-05-13 doc-review walk-through**：`refresh_mode_summary` 字段已由 SG-002 决策移除（R10 更新为"不新增 `refresh_mode_summary` 便利字段"），本条歧义随字段移除自动消解。原始推荐：改写为穷举 case：(a) 全 `failed` → `failed`；(b) 全相同非 `failed` → 该值；(c) 任一不同或 `failed` 与非 `failed` 混合 → `mixed`。
- **FEAS-001 / U1 Files 漏掉 `gitnexus_command_hash` / `code_review_graph_command_hash` 的 dual-write argv**（feasibility 补充，spot-check） — **Applied 2026-05-13 doc-review walk-through**：U1 Files 已拆分为 L460 hash 输入点 + L580 `def provider_commands` 两处 modify entries，要求两处字面值完全一致；U2 Approach L465 已含 tampered incremental package 的 contract test 覆盖要求（GitNexus `commands.incremental[2]` / CRG `commands.incremental[1]`）。

#### P2 deferred entries

- **ADV-004 / 3-5s 速度目标无 baseline 实测**（adversarial）— **Skipped 2026-05-13 doc-review walk-through**。Summary 与 U4 ≤5s gate 都基于推测，未在本仓库实测过 `gitnexus analyze`（无 `--force`）或 `crg update --base`。推荐：U1 之前跑一次 throwaway timing probe，把实测值写入 A3 / Problem Frame；若实测 > 5s，决定 (a) 调整 Summary 目标，或 (b) 是否撤销本计划。
- **ADV-005 / A3 sanity check 仅证明 subcommand 存在、不是语义等价**（adversarial）— **Skipped 2026-05-13 doc-review walk-through**。`update --help` 只证 CLI surface，未证 `update --base` 输出与 `build` 在本仓库语法覆盖等价。推荐：A3 显式区分 (a) CLI 存在（`--help` 已证） vs (b) 输出语义等价（仅 U4 benchmark 能证），并写明 U4 step 6 失败时只对 GitNexus 启用 incremental 的 exit strategy，避免 CRG incremental 代码路径成为沉没成本。
- **ADV-006 / `requires_clean_full_refresh` 死锁陷阱**（adversarial）— **Applied 2026-05-13 doc-review walk-through**：在 R6 `requires_clean_full_refresh` emit 表达式后补充"死锁自动 reset"规则：full 失败但未触碰 native storage 时不额外置 `true`（避免无关失败叠加死锁）；R11 文档要求同步补 doctor 提示（手动删除 status.json 可重置）。原始推荐：(a) 加 doctor 风格诊断说明该状态位的设置原因；(b) 加显式 `--reset-incremental-state` flag 一次性清空 per-provider status.json + native storage；(c) README / 用户手册介绍 `--incremental` 时同步说明 reset 路径。
- **ADV-007 + SEC-002 合并 / `mkdir` lock 在 SIGKILL/OOM/host crash 后残留**（adversarial + security）— **Superseded by 2026-05-13 Auto-resolve B**：repo-scoped lock / stale reclaim / doctor cleanup 已移出本计划，作为独立并发治理 follow-up；active plan 只保留 operator 不并发运行约束。
- **PL-003 / U0 benchmark-first ordering**（product-lens）— **Applied by 2026-05-13 Auto-resolve B**：active plan 已新增 U0 provider extraction proof spike，要求 U1/U2 前证明两个 enabled provider 的 node anchor extraction 与 A→B→C provider-native incremental chain。原始推荐：在 U1 之前插入 U0（~0.5 天 throwaway）：temp clone 内跑 `analyze` / `analyze --force` / `update --base` / `build`，用 `.gitnexus/meta.json` stats + query probe 粗对比验证 provider 原生增量假设；U0 通过后才进 U1/U2。U0 失败则本计划直接作废或收窄到单 provider，避免 U2 沉没成本。
- **SG-002 / `refresh_mode_summary` 是投机性聚合字段**（scope-guardian）— **Applied（字段已移除）2026-05-13 doc-review walk-through**：R10 已更新为"不新增 `refresh_mode_summary` 便利字段"，Consumer 需要精确判断时回读 per-provider status。原始推荐：从 R10 与 graph-facts.v1 移除 `refresh_mode_summary` 字段；保留 `refresh_modes_by_provider` 作为唯一 aggregate truth source；如未来有 consumer 需要 summary 语义，届时再按需添加。
- **COH-001 / 顶层 `refresh_mode` vs `refresh_modes_by_provider` 命名错位**（coherence）— **Applied（加注记）2026-05-13 doc-review walk-through**：在 R10 `refresh_modes_by_provider` 旁加"[命名不对称有意为之：per-provider 单值 `refresh_mode` 是 truth source，aggregate `refresh_modes_by_provider` 是派生 map，复数+后缀区分两者]"注记。原始推荐：在 Phase 4 加一句明确双层契约："Per-provider `status.json` 写单值 `refresh_mode`；aggregate `graph-facts.json` 写 `refresh_modes_by_provider` map。Consumer 必须读 per-provider status 取 truth，aggregate map 仅供概览。"
- **COH-006 / `reason_code` 与 `readiness_source` 在决策流图互用造成混淆**（coherence）— **Applied 2026-05-13 doc-review walk-through**：在 Phase 1 决策流 `otherwise → incremental` 之后加字段映射说明（reason_code 是过程审计字段，readiness_source 是 canonical artifact 字段；full → cold-run；incremental → incremental-update；fallback 成功 → incremental-fallback-full）。原始推荐：Phase 1 末尾加一段映射说明。

#### FYI (advisory only, 不强制决策)

以下条目均为 advisory，2026-05-13 doc-review walk-through 确认保留原文、不修改文档主体：

- **COH-003 / Scope Boundaries "accepted debt" vs "explicitly closed" 边界对称性**（coherence FYI）。log redaction 是 accepted debt，argv injection 是 explicitly closed；两者并列但读者可能误推 "argv 安全足以防 credential 泄露"。可在 Scope Boundaries 加一句 "log redaction debt 与 argv injection 是正交关切；argv 安全不缓解 log credential 泄露"，但纯 prose 优化，不强制。
- **COH-008 / Requirements R1-R11 缺主题分组**（coherence FYI）。11 条平铺，跨决策逻辑 / provider 委托 / fallback / 字段扩展 / 文档等多主题；可考虑加 `### Refresh Mode Decision (R1-R4)` / `### Failure Recovery (R5-R7)` / `### Readiness & Artifacts (R8-R10)` / `### Documentation (R11)` 分组（保留原 R# 编号），但当前结构可工作。
- **COH-009 / "runtime mirror drift 修复" 中 "drift" 时间归属歧义**（coherence FYI）。读者可能误推 drift 是本计划副作用；可显式注 "如本计划实施后发现 `.claude/` / `.codex/` 与 source 不一致，跑 `spec-first init`；此 drift 非本计划引入，属预先存在的 runtime state 问题"。
- **PL-004 + ADV-008 合并 / Contract surface 与 Light contract 哲学的张力**（product-lens + adversarial FYI）。opt-in 阶段就引入 13 个 reason_code + 4 个 per-provider 字段 + 2 个 readiness_source enum + aggregate map + sentinel + lock + env 协议；若 default switch follow-up 长期搁置，这些字段可能成为 orphan infrastructure。可在 Key Technical Decisions 加 "Contract surface trade-off" 段说明：(a) 为何 opt-in 阶段就引入完整集合（避免后续二次扩 schema），(b) 若 default switch 不落地，字段的 deprecation 路径或永久保留策略。
- **SEC-003 / `mcp-tools.json` 本身被恶意 PR 篡改的供应链风险**（security FYI）。pin enforcement 比对方向是 `projected vs mcp-tools.json`，`mcp-tools.json` 本身是 source-of-truth。该风险与现有 full 路径对称，非本计划新引入；可在 Risks 表显式列出并说明 `mcp-tools.json` 变更需 PR review 作为 gate。
- **SG-004 / `attempt_role=primary` 在非 fallback 场景下是零信息**（scope-guardian FYI）。primary 值对单次 full 运行冗余；可改为仅 fallback 场景 emit `attempt_role=fallback`，consumer 通过字段缺失推断 primary。组织偏好级 trade-off，当前形状可工作。



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
  │      requires_clean_full_refresh=true?                  → full (reason_code=clean-full-refresh-required)
  │      per-provider status 未记录 last_indexed_commit?   → full (reason_code=incremental-base-ref-unset)
  │      prior provider status provenance 不可信?           → full (reason_code=incremental-base-status-untrusted)
  │      last_indexed_commit 格式不匹配 ^[0-9a-f]{40}$?    → full (reason_code=incremental-base-ref-invalid-format)
  │      last_indexed_commit commit 在 git 中不存在?       → full (reason_code=incremental-base-ref-missing)
  │      last_indexed_commit 不是 HEAD 祖先?               → full (reason_code=incremental-base-ref-not-ancestor)
  │      otherwise                                          → incremental
  │
  │    [字段映射] reason_code 是过程审计字段（preflight 分支诊断）；readiness_source 是 canonical artifact 字段（R9 enum）。
  │    对应关系：full 路径 → readiness_source=cold-run；incremental 路径 → readiness_source=incremental-update；
  │    incremental 失败后 fallback 成功 → readiness_source=incremental-fallback-full。两者正交，不互相替代。
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
  │        （rationale：query probe 是 provider capability gate 而非 diff correctness gate；
  │         full 模式下同类失败同样走 query-unverified 不 fallback；维持两档模式对 query probe 的
  │         对称处理，否则 incremental 会比 full 更严格，造成 user-visible 行为不一致；
  │         incremental-specific diff drift 的兜底由 U4 benchmark + default switch 保留 opt-in 承担）
  │    full 也失败或当前 provider command 失败且可能触碰 native storage?
  │      → workflow_mode=degraded-fallback；当前 attempt 标记 failed；
  │        requires_clean_full_refresh=true；保留上一次 canonical artifacts
  │        （语义见下方 Artifact 保留矩阵）
  │
  ├─ Phase 4: 写 canonical artifacts
  │    readiness_source：enum 见 R9（cold-run / incremental-update / incremental-fallback-full / skipped / preflight-blocked）
  │    per-provider refresh_mode ∈ {full, incremental, incremental-fallback-full, failed}
  │    command_results[].refresh_mode ∈ {full, incremental}（仅 kind=bootstrap）；attempt_role ∈ {primary, fallback}
  │    aggregate: refresh_modes_by_provider 映射（R10）
  │    last_indexed_commit：clean worktree + readiness 三级证据全过时按 R6 写入当前 HEAD
  │    clean successful canonical refresh 才更新 freshness 字段到当前；
  │    dirty attempt 固定 workflow_mode=blocked + overall_status=action-required；
  │    fallback both-failed attempt 固定 workflow_mode=degraded-fallback；
  │    canonical freshness 指针 carry-forward；readiness 三级证据契约保持不变
```

字段映射：preflight / fallback 分支产出的 `reason_code` 是过程审计字段；`readiness_source` 是 canonical artifact 字段。结果映射为：full → `cold-run`；incremental → `incremental-update`；incremental 失败后 fallback 成功 → `incremental-fallback-full`；blocked / failed 分支按现有 degraded readiness 语义写诊断状态，不把 `reason_code` 当成 `readiness_source`。

**Artifact 保留矩阵（incremental + full 都失败时）**：

| Artifact | 是否覆盖 | 说明 |
|---|---|---|
| `.spec-first/providers/<id>/raw/*.log`（本轮新生成：`update.log` / `analyze.log` / `fallback-analyze.log` / `fallback-build.log` / `status.log` / `query.log`） | **覆盖** | 本轮诊断必须可读；保留上一轮日志会混淆 failure triage |
| `.spec-first/providers/<id>/status.json`（`provider-status.v1`） | **部分覆盖**：`command_results[]` 追加新 attempt、`refresh_mode=failed`、`workflow_mode=degraded-fallback`、当前 attempt readiness 字段写 `status=failed` / `graph_ready=false` / `query_ready=false`、`requires_clean_full_refresh=true`；`last_indexed_commit` 与 prior successful provenance 指针按 R6 carry-forward | 语义：attempt ledger 如实记录两次失败；当前 provider readiness 不能看起来 ready/query-ready；future incremental 被 clean full gate 阻断 |
| `.spec-first/graph/provider-status.json`（aggregate `graph-provider-status.v1`） | **部分覆盖**：`workflow_mode=degraded-fallback`、provider 条目镜像上述 per-provider failed 状态；aggregate 级 canonical freshness 指针 carry-forward | 与 per-provider 保持一致；consumer 看到当前 attempt failed，而不是正常 ready |
| `.spec-first/graph/graph-facts.json`（`graph-facts.v1`） | **不覆盖** `source_revision` / `generated_at` / `timing.*` / `repo_snapshot.*` / `worktree_status_hash` / 其他 canonical freshness 指针；只覆盖 `refresh_modes_by_provider` 的当前失败事实 | 保留上一次 readiness 通过时的指针；`refresh_modes_by_provider.<failed-id>=failed` |
| provider native storage（`.gitnexus/` / `.code-review-graph/`） | **spec-first 不直接触碰 / 不手动回滚** | provider 命令可能已经改写 native storage；因此失败后必须设置 `requires_clean_full_refresh=true`，后续 incremental preflight 只有在 clean successful full 后才可通过 |
| `.spec-first/graph/bootstrap-report.md` | **覆盖** | 本轮 degraded-fallback 报告取代上一轮 |
| normalized envelopes（`architecture-facts.json` / `impact-capabilities.json`） | **不覆盖** | consumer-facing readiness 快照保留上一轮值，直到下次 readiness 三级证据重新通过 |

核心语义：**canonical freshness 指针（`source_revision` / `generated_at` / `timing.*` / `worktree_status_hash` / `last_indexed_commit` / prior successful normalized envelopes）在两次 attempt 都失败时 carry-forward**；**当前 attempt readiness 字段必须报告 failed（`status=failed` / `graph_ready=false` / `query_ready=false`）**；**本轮 log + degraded-fallback 报告必须覆盖**（否则 triage 读到上一轮日志）；**provider native storage 不由 spec-first 回滚，失败后靠 `requires_clean_full_refresh=true` 强制 clean full recovery**。

Fingerprint 分层语义复用 `2026-05-09-003` 的定义（`repo_snapshot.*` 可变 / `spec_first.*` + `provider_projection.*` + `provider.*` 不可变）；本计划只消费不重定义。

---

## Implementation Roadmap

关键路径串行，总工期 ~4.5-5.5 天；实施顺序和里程碑：

```text
Pre-flight   (~2 min)     A4 ack（与 2026-05-09-003 协调决策，默认假设串行即可）
                          （A3 sanity check 已在 planning 阶段通过，PR 描述引用结论即可）
    │
    ▼
U0           (~0.5 d)     Throwaway proof spike：
                          - disposable temp clone 内手动跑 provider-native full/incremental
                          - 证明两个 enabled provider 都能导出 node anchors
                          - 至少跑通 A→B→C 连续增量链的 node capture/equivalence 粗证据
                          - 未通过前不进入 documented `--incremental` 实施
    │
    ▼
U1           (~0.5 d)     write-provider-config.sh/.ps1 扩展 provider_commands()
                          加入 incremental argv；sentinel 原样落地 graph-providers.json
    │
    ▼
U2           (~2-3 d)     bootstrap-providers.sh 核心改造：
                          - shape gate 分层校验（必需 kind 无条件 / incremental 按需）
                          - jq carry-forward payload（R6 写入时机 + 40-hex 校验）
                          - normalized envelopes / aggregate writers 的 prior-read + carry-forward
                          - command_results[] 扩展 refresh_mode/attempt_role + fallback 分支 + 独立 log 路径
                          - resolve_refresh_mode() + fingerprint preflight
    │
    ▼
U3           (~1 d)       PowerShell parity：
                          - bootstrap-providers.ps1 镜像 U2 全部行为
                          - write-provider-config.ps1 镜像 U1
    │
    ▼
U4           (~1.5-2 d)   文档同步 + opt-in 正确性基线 benchmark（disposable temp clone）：
                          - README / 用户手册 / contract doc truth table
                          - 写 benchmark-only graph extraction helper（从 provider 原生
                            存储 .gitnexus/ / .code-review-graph/ 提取 node/edge anchor JSON）
                          - 三类 diff（intra-file / cross-file / file lifecycle）
                          - 两个独立比对：(i) A_full vs B_incremental = A→B delta
                            (ii) B_incremental vs B_full = ∅
                          - Per-provider mandatory gate 全绿（node capture/equivalence 必过；
                            edge 可 N/A 但阻断未来 default switch；含 absolute ≤ 5s）
                            → explicit operator opt-in 计划完成
                          - validation doc 记录脱敏命令元数据 / 耗时 / diff / 决策
    │
    ▼
计划完成（~0 min）        incremental flag-gated operator escape hatch / expert opt-in 上线，
                          本计划交付完成。
                          DEFAULT_REFRESH_MODE_* 保持 full 不变。
                          **Default 切换到 incremental 不在本计划范围**——
                          需独立 follow-up rollout plan（A→B→C→D 链 / rename /
                          parser degradation fuzz 等更宽 gate）支撑后再单行 PR 切换。
```

**回滚**：incremental flag 出问题 → 用户停止使用 `--incremental`（本计划不切默认，无回滚动作）。未来 default 切换后回滚 → 单行反向修改 `DEFAULT_REFRESH_MODE_SINGLE_REPO` 常量，不回滚 schema / flag / canonical artifact 字段。

**关键 blocker**：A4（P0 协调 2026-05-09-003）和 U0 provider extraction proof spike 是进入 U1/U2 前的 blockers；A3 sanity check 已通过（CRG 2.3.3 支持 `update --base`）。

---

## Implementation Units

### U0. Provider extraction proof spike

**Goal:** 在投入 U1/U2 bootstrap 改造前，用 disposable temp clone 证明两个 enabled provider 都有可行 node anchor extraction surface，并且 provider-native incremental 至少能跑通 A→B→C 连续增量链的最低 node capture / equivalence 证据。

**Requirements:** R2, R8, R11

**Dependencies:** P0 Blocker ack（A4 串行 / 并行决策）

**Files:**
- Create: `tests/benchmark/extract-graph-anchors.sh`（先以 proof spike 所需的最小 node anchor extraction 支持落地；U4 可继续扩展 edge / impact 输出）
- Create: `docs/validation/2026-05-12-graph-bootstrap-incremental-benchmark.md`（第一节记录 U0 proof 结论；U4 继续追加完整 benchmark）

**Approach:**
- 在 disposable temp clone / isolated worktree 内运行，禁止污染当前 repo canonical `.spec-first/graph/` artifacts。
- 先用 provider 原生命令手动验证基础路径，不依赖尚未实现的 `--incremental` flag：
  - GitNexus：A 跑 `analyze --force`，B/C 跑不带 `--force` 的 `analyze`。
  - code-review-graph：A 跑 `build`，B/C 跑 `update --base <previous_commit>`。
- `tests/benchmark/extract-graph-anchors.sh` 必须能对两个 enabled provider 产出稳定 node anchor 集合（`path` / `kind` / `name` / `span`）。edge anchor 可先记录 `extractable: yes|no`，不作为 U0 通过条件，但会约束 U4/default-switch。
- 构造 A→B→C 最小链：B 至少覆盖单文件函数变化，C 至少覆盖跨文件 import/call 变化。每一步先列预期 node delta，再跑 provider-native incremental，再用 helper 比对 node delta 与同 commit full checkpoint 的 node set 粗等价。
- U0 未通过时，U1/U2 不进入 documented `--incremental` 实施；可选出路只有收窄到单 provider、保持 experimental / undocumented，或重写计划。不得用 stats-only / query probe 代替 node anchor proof。
- validation doc 只记录脱敏命令元数据、exit code、duration、anchor counts、diff 摘要和结论；禁止粘贴 provider 原始 stdout/stderr 或未脱敏 URL。

**Test scenarios:**
- Happy: 两个 provider 均可导出 node anchors，A→B→C incremental node delta 与 full checkpoint 粗等价。
- Error: 任一 provider 只能给 stats / query probe、不能给 node anchors → U0 fail / inconclusive，本计划不得把 `--incremental` 作为 correctness-backed opt-in 对外记录。

**Verification:**
- `tests/benchmark/extract-graph-anchors.sh` 在 temp clone 中对 GitNexus 和 CRG 均能输出合法 JSON。
- validation doc 第一节含 U0 pass/fail、脱敏 metadata、anchor diff 摘要和是否允许继续 U1/U2 的明确结论。

---

### U1. `graph-providers.json` 投影扩展 incremental 命令 slot

**Goal:** 把 `mcp-tools.json` 的 provider pin 投影到 `.spec-first/config/graph-providers.json.providers.<id>.commands.incremental`。

**Precondition:** Open Questions / P0 Blocker 段的 fast-reuse 协调决策已在 PR 描述中被显式 ack（默认假设串行亦算 ack），且 U0 provider extraction proof spike 已通过。A3 的 CRG `update --base` sanity check 已在 planning 阶段完成（CRG 2.3.3 支持 `update [--base BASE]`），PR 描述引用该结论即可；仅在 CRG pin 升级或行为变化时才复跑。

**Requirements:** R2

**Dependencies:** U0

**Files:**
- Modify: `skills/spec-mcp-setup/scripts/write-provider-config.sh` —— **必须改两处（dual-write source-of-truth）**，否则 `incremental` kind 不能被 `provider-projection-stale` gate 覆盖：
  - **L460 区域**：`gitnexus_command_hash` / `code_review_graph_command_hash` 的 `jq -n -S -c` hash 输入 object（用于计算 bundled pin hash 作为 gate 比对 truth）必须同步加 `incremental` key，与下方 `def provider_commands($key)` 字面值完全一致。
  - **`def provider_commands($key)` ~L580**：projection 输出 object 加 `incremental` argv 构造（gitnexus: `["npx","-y",$gitnexus_package,"analyze"]`；code-review-graph: `["uvx",$code_review_graph_package,"update","--base","__SPEC_FIRST_LAST_INDEXED_COMMIT__"]`）。
  - 这是 commands 的实际构造点，**commands 不在 `mcp-tools.json` 里**——后者只是 package/version pin。两处不一致会让 bundled hash 与 projected argv 永远 drift / 让 `commands.incremental` 的 package spec tampering 绕过 pin enforcement。
- Modify: `skills/spec-mcp-setup/scripts/write-provider-config.ps1`（`Get-ProviderCommands` 等价函数 + PowerShell 等价的 hash 输入函数；PowerShell parity，同样 dual-write 要求）
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
- Modify: `docs/contracts/graph-provider-consumption.md`（**本计划决策：不新增 JSON schema 文件**；`src/cli/contracts/graph/` 目录当前不存在，canonical 验证面维持 prose contract + Jest assertion；在 consumption 契约中新增 truth table 列出所有新字段：`readiness_source` 全枚举值、顶层 `refresh_mode` / `fallback_from_incremental` / `last_indexed_commit` / `requires_clean_full_refresh`、`command_results[]` 扩展的 `refresh_mode` + `attempt_role`、`refresh_modes_by_provider` + consumer 使用规则）
- Test: `tests/unit/graph-provider-consumption-contracts.test.js`（扩展字段/枚举断言）
- Test: `tests/unit/spec-graph-bootstrap.sh`（**已存在** 89KB shell 测试；在其基础上追加 incremental 决策矩阵、fallback 路径、carry-forward 写入的新 scenario；沿用文件既有测试模式）
- Test: `tests/unit/spec-graph-bootstrap-contracts.test.js`（**已存在** Jest 契约测试；扩展 readiness_source 枚举 + `refresh_mode` / `refresh_modes_by_provider` / `command_results[].refresh_mode` / `requires_clean_full_refresh` 字段断言）

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
    - code-review-graph incremental: `["uvx", "code-review-graph@<pin>", "update", "--base", "<sentinel>"]`（5 元素；projected config 只允许 sentinel，运行时 resolved argv 才替换为 status-derived SHA）
  - **jq alternation 规范（重要安全收紧：projected shape 只接受 sentinel，不接受 40-hex）**：
    ```jq
    $kind == "incremental" and $provider == "code-review-graph" then
      $tail[0] == "update" and $tail[1] == "--base" and
      ($tail[2] | test("^__SPEC_FIRST_[A-Z_]+__$"))
    ```
    **安全理由**：projected config 是 setup projection 产物，不应承载 per-repo 动态状态。如果 shape 允许 40-hex，CI / 恶意 PR / 手改可以把 `graph-providers.json.providers["code-review-graph"].commands.incremental[4]` 写成任意合法 SHA（包括攻击者选的 outdated / 外部 repo SHA），bootstrap 直接用那个 SHA 跑 `update --base <payload>`，**绕过** per-provider `status.json.last_indexed_commit` 的 truth source 与 R6 的合法性校验（merge-base / 格式 / requires_clean_full_refresh）。收紧为 sentinel-only 把 "动态 base ref 必须来自已验证 truth source" 做成 shape-level 不变量，projected config 里出现 40-hex 直接视为 shape 非法 → `emit_blocked unsupported-provider-command`。
    Shape gate 在 bootstrap 执行期运行：读取已投影 config 后、命令执行前完成。R6 的 40-hex 合法性适用于从 per-provider status 读出的 `last_indexed_commit` 以及 sentinel 替换后的 resolved argv。
  - Contract test 必须覆盖四个分支：(a) 字段缺失 → `full + incremental-command-unavailable`；(b) 字段存在且含 sentinel → 执行；(c) 字段存在但 shape 非法（`bash -c` / 未知 subcommand / shell metacharacters）→ `emit_blocked`；(d) **字段存在但 base slot 是 40-hex 而非 sentinel**（模拟 CI / PR 把 projected config 改成固定 SHA 绕过 status truth source）→ `emit_blocked`。
- Provider 执行按 refresh_mode 选 argv；失败进 fallback 重跑 full。
- **CRG base ref 来源与 carry-forward 写入语义**：按 R6 执行（来源、prior status provenance 校验、写入时机 + 旧值 carry-forward + dirty-aware + `requires_clean_full_refresh` 状态位、合法性含 40-hex 格式校验）。U2 实施要点：
  - `write_provider_status()` 的 `jq -n` payload 必须改为先读旧 `status.json`（如 `prior=$(jq -c '.' "$status_path" 2>/dev/null || echo null)`），然后按 R6 写入时机 emit `last_indexed_commit` 与 `requires_clean_full_refresh` 两个字段。
  - **Sentinel 内存替换路径（关键实施约束）**：bootstrap 脚本读取 `.spec-first/config/graph-providers.json` 后，**仅在内存中**用 `jq -c --arg sha "$last_indexed_commit" '.providers["code-review-graph"].commands.incremental | map(if . == "__SPEC_FIRST_LAST_INDEXED_COMMIT__" then $sha else . end)'` 产出 resolved argv；**不回写** `graph-providers.json`（违反 Scope Boundaries 的 setup-owned config 只读规则）。
  - **Resolved argv 强校验（与 projected shape 收紧配合）**：
    1. Projected shape gate 已保证 `commands.incremental[4]` == sentinel；若 shape gate 通过但此处发现非 sentinel，视为 invariant violation 直接 `emit_blocked unsupported-provider-command`（防御性断言，正常不应触发）。
    2. 替换前，从 per-provider `status.json.last_indexed_commit` 读取 `$last_indexed_commit`，按 R6 合法性链跑完：未记录 → `incremental-base-ref-unset` / prior status provenance 不满足 `schema_version`、`graph_ready`、`query_ready`、clean `repo_snapshot` 与 fingerprint source_revision 对齐 → `incremental-base-status-untrusted` / 格式不匹配 `^[0-9a-f]{40}$` → `incremental-base-ref-invalid-format` / 不存在 → `incremental-base-ref-missing` / 非祖先 → `incremental-base-ref-not-ancestor` / `requires_clean_full_refresh=true` → `clean-full-refresh-required`。任一失败直接 full，不做替换。
    3. 替换完成后，**再次**断言 resolved argv 中原 sentinel 位置的新值匹配 `^[0-9a-f]{40}$`（防御性；正常由 step 2 保证）；不匹配回到 full + `incremental-base-ref-invalid-format`。
    4. resolved argv 只用于 `run_configured_command` 单次调用，不落盘、不回写、不日志明文。
- **Incremental package pin enforcement**：现有 `provider-projection-stale` gate（reason_code `gitnexus-provider-projection-stale` / `code-review-graph-provider-projection-stale`）只覆盖 `bootstrap / status / query_probe` 三个 kind 的 bundled-vs-projected pin 比对。本 unit 必须把 `incremental` kind 也纳入同一 gate——projected `commands.incremental` argv 中的 package spec 与 `mcp-tools.json` bundled pin 不一致 → 同样 `provider-projection-stale` 失败前置阻断；contract test 必须覆盖 tampered incremental package 场景（GitNexus 修改 `graph-providers.json.providers.gitnexus.commands.incremental[2]`，code-review-graph 修改 `graph-providers.json.providers["code-review-graph"].commands.incremental[1]`）。
- **并发边界（不新增 lock）**：本计划不引入 repo-scoped lock / mutex / concurrent-run reason_code；显式 bootstrap 仍由 operator 负责串行运行。同一仓库并发 bootstrap 会互相覆盖 provider status 与 aggregate artifacts，作为已知风险写入 Risks，并移交独立并发治理计划处理（含 stale-lock reclaim / doctor cleanup）。README / graph-bootstrap 专项说明只写操作约束：不要并发运行同一仓库的 graph bootstrap。
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
    - `requires_clean_full_refresh`（布尔；R6/R7 dirty 与 failed-native-storage recovery 保护机制，dirty 跑任何刷新或 provider command failure 置 true，clean full 成功清除）
    - 现有 `command_results[]` 顶层数组的 `kind=bootstrap` 元素扩展 `refresh_mode` ∈ `{full, incremental}` 与 `attempt_role` ∈ `{primary, fallback}`（**不新增独立 `bootstrap_attempts[]`**）
  - `.spec-first/graph/provider-status.json`（`graph-provider-status.v1`，aggregate）的 `providers[]` 继承上述字段
  - `.spec-first/graph/graph-facts.json`（`graph-facts.v1`）顶层新增字段由 aggregate writer（L1904-1957）派生：`refresh_modes_by_provider = $providers | map({(.provider): .refresh_mode}) | add`；不新增 `refresh_mode_summary`
  - Raw log / fallback 命名（按 provider 区分）：GitNexus fallback 产 `fallback-analyze.log`，CRG fallback 产 `fallback-build.log`（provider id 由 bootstrap-providers.sh L726-729 的 allowlist 保证路径安全）
- **Artifact retention 写入路径（避免 helper 重写擦除 prior truth）**：
  - `write_provider_status()`、`write_normalized_artifacts()`、aggregate `.spec-first/graph/provider-status.json` writer、aggregate `.spec-first/graph/graph-facts.json` writer 都必须先读取 prior artifact，再决定当前字段。
  - dirty run 或 incremental + fallback full 都失败时，**跳过 normalized envelopes 重写**（`architecture-facts.json` / `impact-capabilities.json` 保持上一轮 readiness 通过内容），并 carry-forward canonical freshness fields：`source_revision`、`repo_snapshot.worktree_dirty`、`worktree_status_hash`、`generated_at` / `timing.*`、prior successful normalized envelopes。
  - 当前 attempt 的诊断事实仍要写入 per-provider / aggregate status（`status=failed`、`graph_ready=false`、`query_ready=false`、dirty 的 `workflow_mode=blocked` + `overall_status=action-required` 或 both-failed 的 `workflow_mode=degraded-fallback`），但不得让 failed/dirty attempt 看起来是当前 HEAD 的 clean query-ready readiness。
- Readiness 三级证据在 incremental 下仍必过；不达标走现有 `query-unverified` 路径。
- **Provider command failure recovery**：任何 bootstrap/update command 失败且可能触碰 provider native storage（含 incremental 失败后 fallback full 也失败）都写 `requires_clean_full_refresh=true`；后续 incremental preflight 必须降级 full，直到 clean successful full 清除该字段。
- **Dirty worktree 处理**：按 R7 执行——强制降级 full，`reason_code=dirty-worktree-incremental-not-allowed`，不读取任何 opt-in flag（R7 无 opt-in 路径）；dirty run 不发布正常 ready/fresh canonical graph facts，只写 dirty-scoped diagnostic 状态（`workflow_mode=blocked` + `overall_status=action-required` + `reason_code=dirty-refresh-non-canonical`）并 carry-forward canonical freshness 指针。
- 脚本顶部声明 `DEFAULT_REFRESH_MODE_SINGLE_REPO=full` 和 `DEFAULT_REFRESH_MODE_ALL_REPOS=full` 两个常量（见 R1 与 Rollout）。

**Execution note:** 先写 contract test（断言字段 + 决策矩阵），再改脚本；fallback 路径用 mock exit code 隔离验证。

**Test scenarios:**
- Happy: fingerprint repo_snapshot 仅 commit 变化 + `--incremental` flag → `refresh_mode=incremental`，`readiness_source=incremental-update`。
- Happy: 首次 bootstrap → `full`，`readiness_source=cold-run`。
- Happy: `--force` → `full`。
- Happy: 初始期 `DEFAULT_REFRESH_MODE_SINGLE_REPO=full` 且无 flag → `full`（即使 fingerprint 非 repo-snapshot 未变）；`--all-repos` 覆盖 `DEFAULT_REFRESH_MODE_ALL_REPOS=full`。
- Happy (R1 CLI flag 分流矩阵)：
  - (a) 直接 `--all-repos` → 解析为 ALL_REPOS 常量（走 `DEFAULT_REFRESH_MODE_ALL_REPOS`）。
  - (b) 无 `--all-repos` flag → 走 SINGLE_REPO 常量。
  - （env-driven child propagation / parent-workspace candidate mode 的 (c)/(d) 场景已 deferred 到 follow-up rollout plan，不在 U2 测试矩阵内。）
- Edge: per-provider `last_indexed_commit` 未记录 → `full`，`reason_code=incremental-base-ref-unset`。
- Edge: per-provider prior status 缺 schema_version、`graph_ready=false`、`query_ready=false`、`repo_snapshot.worktree_dirty=true`，或 `repo_snapshot.source_revision` / `bootstrap_fingerprint.repo_snapshot.source_revision` 与 `last_indexed_commit` 不一致 → `full`，`reason_code=incremental-base-status-untrusted`。
- Edge: `last_indexed_commit` 格式不匹配 `^[0-9a-f]{40}$`（模拟污染值 `"--output=/tmp/evil"` 或 `" foo"`） → `full`，`reason_code=incremental-base-ref-invalid-format`；argv 不会被执行。
- Edge: `last_indexed_commit` 在 git 中不存在 → `full`，`reason_code=incremental-base-ref-missing`。
- Edge: `last_indexed_commit` 非 HEAD 祖先 → `full`，`reason_code=incremental-base-ref-not-ancestor`。
- Edge: carry-forward — full 成功 → incremental 失败（query-unverified）→ 下次跑 → per-provider status.json 的 `last_indexed_commit` 仍为**首次 full 时的 HEAD**（不被中间失败擦除），下次 `--incremental` 可启动。
- Edge: fingerprint.spec_first.mcp_tools_hash 变化 → `full`，`reason_code=fingerprint-spec-first-changed`。
- Edge: dirty worktree + `--incremental` → `full`，`reason_code=dirty-worktree-incremental-not-allowed`（无 opt-in 逃生路径）。
- Edge (requires_clean_full_refresh 完整状态机 lifecycle，验证 R7 保护能解锁)：
  - Step 1 — 从 clean worktree + 已跑通 full 的基线开始（`requires_clean_full_refresh=false`）。
  - Step 2 — 脏化 worktree 后跑 `--incremental` → 降级 full（`reason_code=dirty-worktree-incremental-not-allowed`）；断言 per-provider status.json 写入 `requires_clean_full_refresh=true`，`last_indexed_commit` **未**推进（保持 Step 1 基线值）。
  - Step 2 额外断言：dirty run 不更新正常 ready/fresh canonical graph facts；aggregate/report 只反映 dirty-scoped diagnostic 状态（`workflow_mode=blocked` + `overall_status=action-required`），canonical freshness 指针仍指向 Step 1 clean 成功值。
  - Step 3 — 清理 worktree（`git stash` 或还原），再跑 `--incremental` → 即使现在 clean，preflight 见到 `requires_clean_full_refresh=true` 仍降级 full（`reason_code=clean-full-refresh-required`）；断言本次 full 成功且 `requires_clean_full_refresh` 被清为 `false`，`last_indexed_commit` 推进到当前 HEAD。
  - Step 4 — 再次跑 `--incremental` → 正常进 incremental（`refresh_mode=incremental`，`readiness_source=incremental-update`），证明 R7 状态位能正确解锁。
- Edge: full 成功（cold-run）后再跑 incremental → per-provider status.json 已有 last_indexed_commit（指向首次 full 时的 HEAD），incremental 可启动；否则 `reason_code=incremental-base-ref-unset`（证明 R6 写入时机正确）。
- Shape gate: 扩展后的 `command_shape_supported()` 拒绝 incremental kind 的非法 argv（`bash -c` / 未知 subcommand / 含 shell metacharacters）→ `emit_blocked blocked unsupported-provider-command`。
- Shape gate (sentinel-only 收紧)：projected `graph-providers.json.providers["code-review-graph"].commands.incremental[4]` 被 tampered 为合法 40-hex（模拟 CI / 恶意 PR 把固定 SHA 硬编码进 projected config 绕过 status truth source）→ shape gate 拒绝，`emit_blocked unsupported-provider-command`；同时证明 projected config 不承载 per-repo 动态 base ref。
- Raw log: incremental 失败后 fallback full 成功 → `command_results[]` 保留两条 `kind=bootstrap` 条目（一条 `refresh_mode=incremental, attempt_role=primary`，一条 `refresh_mode=full, attempt_role=fallback`）；GitNexus 两条 `raw_log` 分别指向 `analyze.log` 与 `fallback-analyze.log`，CRG 两条 `raw_log` 分别指向 `update.log` 与 `fallback-build.log`；`raw_logs` 仅保持现有 backward-compat latest-kind alias，不新增 `raw_logs.incremental` / `raw_logs.fallback` 子键。
- Aggregate: 两个 provider 一个 incremental 一个 fallback-full → `graph-facts.refresh_modes_by_provider` 反映差异。
- Aggregate: 一个 provider incremental 成功 + 一个 provider incremental+full 都失败 → `refresh_modes_by_provider.<failed-id>=failed`；workflow_mode=degraded-fallback。
- Error: incremental 命令 exit != 0 → 重跑 full，`fallback_from_incremental=true`，`readiness_source=incremental-fallback-full`。
- Error: incremental 成功但 query probe 失败 → `status=query-unverified`，不 fallback。
- Error: incremental + full 都失败 → `workflow_mode=degraded-fallback`，`reason_code=incremental-and-full-failed`，`requires_clean_full_refresh=true`。
- Error (artifact 保留矩阵)：baseline 状态 `last_indexed_commit=<commit_X>`、`graph_ready=true` 已写入；然后跑 incremental + full 都失败 → 断言当前 per-provider status 写 `status=failed` / `graph_ready=false` / `query_ready=false` / `refresh_mode=failed` / `requires_clean_full_refresh=true`，同时 `last_indexed_commit` 仍为 `<commit_X>`（carry-forward 未擦除）；normalized envelopes `architecture-facts.json` / `impact-capabilities.json` 保持上一轮内容；本轮新日志（`update.log` / `fallback-analyze.log` / `fallback-build.log`）覆盖写入；`bootstrap-report.md` 反映本轮 degraded-fallback；后续 incremental preflight 必须因 `clean-full-refresh-required` 降级 full，直到 clean full recovery。

**Verification:**
- 同 HEAD 下 `--incremental` 与 `--force` 跑出的 artifacts 核心 readiness 字段（status=ready, query_ready=true）一致。A→B 差分对照在 U4 benchmark 中做。
- canonical artifacts 字段扩展符合 consumption contract（含 `refresh_modes_by_provider`、`requires_clean_full_refresh`、`command_results[]` 扩展字段）。
- fingerprint 决策矩阵全分支在 contract test 覆盖（含 dirty-worktree-incremental-not-allowed、base-ref-unset、base-status-untrusted 新分支）。
- **last_indexed_commit 写入时机测试**：首次 full 成功后 per-provider status.json 包含当前 HEAD 的 `last_indexed_commit`；再跑 incremental 能读到并通过 preflight。
- **requires_clean_full_refresh 状态机测试**：Step 2 dirty run 置 `true` 且 `last_indexed_commit` 不推进；Step 3 clean full 清为 `false` 且推进 `last_indexed_commit`；Step 4 incremental 可启动。
- **R1 CLI flag 分流测试**：`--all-repos` 命中 ALL_REPOS 常量、无 flag 命中 SINGLE_REPO 常量两档。（env-driven child propagation / parent-workspace candidate mode 的扩展场景已 deferred。）
- **base status provenance 测试**：prior per-provider status provenance 任一关键字段不可信时降级 full，`reason_code=incremental-base-status-untrusted`。
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

**Verification:** parity 测试通过；核心常量（`refresh_mode`、`incremental-update`、`incremental-fallback-full`、`incremental-base-ref-missing`、`incremental-base-ref-unset`、`incremental-base-status-untrusted`、`incremental-base-ref-not-ancestor`、`dirty-worktree-incremental-not-allowed`、`dirty-refresh-non-canonical`、`DEFAULT_REFRESH_MODE_SINGLE_REPO`、`DEFAULT_REFRESH_MODE_ALL_REPOS`）在两个脚本中都存在；`command_shape_supported` 的 incremental kind 分支 parity 对齐；**R1 CLI flag 分流两档（`--all-repos` 命中 ALL_REPOS / 无 flag 命中 SINGLE_REPO）parity 对齐**（env-driven child propagation parity 已 deferred）；`requires_clean_full_refresh` 状态机 lifecycle parity（dirty 置 true → clean full 清 false → incremental 可启动）。

---

### U4. 文档 / benchmark / rollout

**Goal:** 同步 README、用户手册、契约文档；跑一次 benchmark 验证 explicit operator escape hatch / expert opt-in 的最低正确性基线并记录 rollout 状态；登记 CHANGELOG。默认切换留给独立 follow-up rollout plan。

**Requirements:** R11

**Dependencies:** U2, U3

**Files:**
- Modify: `docs/contracts/graph-provider-consumption.md`（readiness_source truth table）
- Modify: `docs/contracts/graph-evidence-policy.md`（Refresh Trigger Policy 表下加一行 post-commit 运维建议；**必须的 guidance 文本**："commit 之后 canonical `graph-facts.json` 立即 stale；**clean single-repo** operator 在需要 query / review 且接受 expert opt-in 边界时可显式运行 `$spec-graph-bootstrap --incremental`，不必等全量重跑。`--all-repos` 仍走 full 默认，`--incremental` + dirty worktree 会被强制降级为 full。"）
- Modify: `docs/05-用户手册/02-核心概念.md` / `04-workflows-artifacts-map.md` / `05-最佳实践.md`（两档刷新一句话心智模型）
- Modify: `README.md` / `README.zh-CN.md`（`$spec-graph-bootstrap` 使用段增加两档说明）
- Modify: `CHANGELOG.md`
- Modify: `docs/validation/2026-05-12-graph-bootstrap-incremental-benchmark.md`（U0 第一节基础上追加完整 benchmark）
- Modify: `tests/benchmark/extract-graph-anchors.sh`（从 U0 node proof 扩展到 U4 node/edge anchor helper）

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
5. **Provider 原生 graph 提取（benchmark-only helper）**：normalized artifact（`architecture-facts.json` / `impact-capabilities.json`）当前是 readiness envelope，**不含**完整 node/edge facts。U0 已创建 `tests/benchmark/extract-graph-anchors.sh` 的最小 node proof，U4 在此基础上扩展 edge / impact 输出（或记录 `N/A`）。

   **GitNexus 原生存储实测是 LadybugDB 二进制格式**（`.gitnexus/lbug` 约 180MB `data` 文件 + `.gitnexus/meta.json` 统计摘要；`sqlite3` 打开报 "file is not a database"）。**不要**假设可用 SQLite 直查。候选 extraction surface：
   - **GitNexus CLI query**（现已在 bootstrap query probe 中使用：`npx -y gitnexus@<pin> query <token> --repo <name>`）；是否支持 bulk 导出 node/edge 由 U4.0 preflight 调研确定。
   - **GitNexus MCP API**（bootstrap 期间暴露的 query surface）——若 MCP 接口提供 symbol 列表 / reference graph，可作为提取来源。
   - **`.gitnexus/meta.json` 统计字段**（`stats.nodes` / `stats.edges` / `stats.files`）——量级校验可用，**不足以**做 anchor-level 对称差集，也不能单独支撑 opt-in 正确性通过。
   - 以上都不可用 → validation 结果为 inconclusive / fail；`--incremental` 最多保持 experimental / undocumented，不得标记为 correctness-backed opt-in。

   **CRG 原生存储**：候选 surface 为 `uvx code-review-graph@<pin> status --repo <path>`（现 query probe 已使用），或其内部 serialized facts；同样由 U4.0 preflight 决定实际可用导出方式。

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

   **U4.0 Preflight Gate（实施时机：U2/U3 完成后、U4 主体 step 1 之前；用于复核 U0 已证明的 extraction surface 是否能通过正式 `--incremental` 路径工作。U0 已经是 U1/U2 前的 blocker，U4.0 不再承担首次证明职责）**：
   - 确认每个 enabled provider 有可行 extraction surface 能产出 **node anchor 集合**；node extraction 是 opt-in correctness pass 的 mandatory gate，validation doc 只记录脱敏命令元数据、exit code、耗时、稳定性和结果摘要，禁止 provider 原始 stdout/stderr 或未脱敏 URL。
   - 尽力确认每个 provider 有可行 extraction surface 能产出 **edge anchor 集合**。某 provider 的 edge anchor 无法从 CLI / MCP 提取 → 记录为 `extractable: no`；U4 pass matrix 的 edge 行对该 provider 用 `N/A`；本计划仍可完成 documented operator opt-in，但 validation doc 必须标注"edge correctness 证据受限"，且 default-switch follow-up plan 必须先闭环该 extraction gap。
   - 任一 enabled provider 的 node extraction 不可用 → U4 validation inconclusive / fail；不得把 stats-only + query probe 标记为 opt-in correctness pass，`--incremental` 最多保持 experimental / undocumented。

6. **对照（拆成 node + edge 两组独立比对）**：

   benchmark 产出 3 份 artifact 对应的 anchor JSON：`A_full_anchors`、`B_incremental_anchors`、`B_full_anchors`。四个独立比对（node 两个 + edge 两个）：

   - **比对 (i) — Incremental node capture**：`A_full_anchors.nodes` vs `B_incremental_anchors.nodes` 的对称差集 = step 2 预先列出的 A→B **node delta**（验证 incremental 捕捉了节点变化）
   - **比对 (ii) — Incremental node equivalence**：`B_incremental_anchors.nodes` vs `B_full_anchors.nodes` 的对称差集 = **∅**（验证 incremental 与同 commit 的 full node 集合等价）
   - **比对 (iii) — Incremental edge capture**（当 provider edge anchor 在 U4.0 preflight 标记为 `extractable: yes`；否则该 provider 此行记 `N/A` 并作为 default-switch blocker，不把 stats-only 当 edge correctness 证据）：`A_full_anchors.edges` vs `B_incremental_anchors.edges` 的对称差集 = step 2 预先列出的 A→B **edge delta**（IMPORTS/CALLS 级联更新——cross-file 场景的关键信号）
   - **比对 (iv) — Incremental edge equivalence**（同上可 `N/A`）：`B_incremental_anchors.edges` vs `B_full_anchors.edges` 的对称差集 = **∅**

   四个比对相互独立；node 两项对每个 enabled provider 必须通过，否则 validation fail / inconclusive。edge 两项在 extraction 不可用时允许 `N/A`，但 validation doc 必须写入理由并限制 follow-up rollout 的 default switch 条件。stats-only / query-probe-only 弱证据不能让 opt-in correctness pass 成立。

   Flow / community count 允许抖动（±1% 或实测 baseline 后定的阈值）。

7. **Per-provider pass matrix**：

   | Provider | (i) Node capture | (ii) Node equivalence | (iii) Edge capture | (iv) Edge equivalence | readiness_source 未 fallback | Query probe no degradation | Duration ratio (B_incr ≤ B_full / 3) |
   |---|---|---|---|---|---|---|---|
   | gitnexus | 必过 | 必过 | 必过 或 `N/A`（preflight 决定） | 必过 或 `N/A` | 必过 | 必过 | 必过 |
   | code-review-graph | 必过 | 必过 | 必过 或 `N/A`（preflight 决定） | 必过 或 `N/A` | 必过 | 必过 | 必过 |

   - **Mandatory extraction floor**：每个 enabled provider 必须至少具备 node capture + node equivalence 的 anchor-level 证据；若 node extraction 不可用，validation 失败或 inconclusive，不能以 meta stats / query probe 通过 opt-in correctness。
   - **readiness_source 未 fallback**：B_incremental 的 `readiness_source=incremental-update`（**不是** `incremental-fallback-full`，**不是** `cold-run`）。**注意**：此字段仅证明 spec-first 调用时未触发 fallback（即 `--incremental` 命令形式跑通且未降级），**不**断言 provider 内部真正走了 diff 索引——后者由 `Duration ratio` 间接支撑（如果 provider 内部全量重建，duration 不会显著低于 full）。这与 R9 的字段语义定义一致。
   - **Absolute duration**（对齐 Summary 的 ~3-5 秒承诺）：**所有 provider 累计** `B_incremental_total_duration ≤ 5s`

8. **Rollout 决策**：本计划 U4 的角色是 **explicit operator escape hatch / expert opt-in 正确性基线**（incremental 开关功能可用、对一组合成 diff 表现等价）；
   - **不**自动触发默认切换。所有 mandatory criteria + absolute ≤ 5s 全绿 → incremental flag 可作为 documented operator opt-in 上线，Plan 视为完成。
   - **Default 切换到 incremental** 需独立的 follow-up rollout plan，覆盖更宽场景（A→B→C→D 连续增量链 / 文件 rename / parser degradation fuzz / 大规模重命名 / 长 commit 链累积误差等）+ 多次重复 benchmark 收集 baseline。本计划 U4 的成功 ≠ 默认切换的充分证据。
   - 任一 mandatory criterion 不过，或只能得到 stats-only / query-probe-only 弱证据 → validation fail / inconclusive，保留 `full` 默认，`--incremental` 不作为 correctness-backed opt-in 对外宣传；validation doc 记录失败行（哪个 provider / 哪个 criterion / 实测值），且 follow-up rollout plan 必须先解决该失败模式。
9. **Teardown**：删除 temp clone / worktree 和附带的 branch。

**Verification:**
- 用户文档一致使用术语（`incremental` / `full`，中文「增量」/「全量」）。
- README 中英一致。
- validation doc 包含脱敏命令元数据、耗时、readiness 字段、差异观察和 rollout 状态（默认切换仍 deferred）；不包含 provider 原始 stdout/stderr 或未脱敏 URL。
- CHANGELOG 按仓库现行格式登记。

---

## System-Wide Impact

- **Canonical artifact 扩展：** `readiness_source` enum 增加 2 个值；`refresh_mode`（值域 `{full, incremental, incremental-fallback-full, failed}`）/ `fallback_from_incremental` / `last_indexed_commit` / `requires_clean_full_refresh` 为新可选字段（per-provider 顶层）；现有 `command_results[]` 元素扩展可选 `refresh_mode` + `attempt_role`（不引入独立 `bootstrap_attempts[]`，避免 schema double ledger）；`refresh_modes_by_provider` 映射为 aggregate graph-facts 新字段；不新增 `refresh_mode_summary`。所有现有 consumer 对 `readiness_source` 无硬分支，新值透明。
- **Error propagation：** incremental 失败自动 fallback full；fallback full 也失败按现有 `workflow_mode=degraded-fallback` 处理；dirty / non-canonical attempt 固定 machine-readable combo 为 `workflow_mode=blocked` + `overall_status=action-required`，`action-required` 不是 `workflow_mode` 值。**不新增 workflow-level error category**（workflow_mode 仍是现有 `primary` / `degraded-fallback` / `blocked` / `no-source`）；**新增若干 incremental 相关 reason_code**（`incremental-refresh-failed-fallback-full`、`incremental-base-ref-missing`、`incremental-base-ref-unset`、`incremental-base-status-untrusted`、`incremental-base-ref-invalid-format`、`incremental-base-ref-not-ancestor`、`incremental-and-full-failed`、`incremental-command-unavailable`、`dirty-worktree-incremental-not-allowed`、`dirty-refresh-non-canonical`、`clean-full-refresh-required`、`fingerprint-spec-first-changed`、`fingerprint-projection-changed`、`fingerprint-provider-changed`），由 consumption 契约 + contract test 扩展声明（不新增 JSON schema 文件，沿用 prose + Jest 验证模式）。
- **API surface：** CLI 新增 `--incremental` / `--full` / `--force`；PowerShell `-Incremental` / `-Full` / `-Force`。
- **Unchanged invariants：** schema 版本不 bump；refresh ownership / readiness 三级证据 / source-runtime 边界 / setup-owned config 只读等既有约束全部保持。

---

## Risks & Dependencies

| Risk | Mitigation |
|---|---|
| `code-review-graph update --base` 在 pinned 2.3.3 下不可用或语义不等价 | U0 proof spike 在 U1/U2 前验证 provider-native A→B→C node chain；必要时走 `2026-05-09-005` pin 升级流程或只对 GitNexus 启用 incremental。 |
| GitNexus `analyze`（不带 `--force`）实际退化为全量 | benchmark 核验耗时；如耗时未显著下降，保留 full 默认；`readiness_source=incremental-update` 的字段语义已在 R9 限定为"调用形式"，不声称 graph diff。 |
| incremental 失败率高导致体验变差（fallback 耗时叠加） | `fallback_from_incremental` 字段可观测；本计划默认仍为 full。任一 observed `fallback_from_incremental=true` 后，operator 应停用 `--incremental`，调查 provider / artifacts 后再显式重试；默认值单行回滚只属于未来 default-switch follow-up。 |
| `--all-repos` 多仓场景未经 benchmark 验证 | 本计划保持 `DEFAULT_REFRESH_MODE_ALL_REPOS=full`；`--all-repos` incremental default switch 需要独立多仓 validation；`--incremental` 只是 clean single-repo explicit operator escape hatch，不是未验证多仓默认切换的 mitigation。 |
| 与 `2026-05-09-003` fast-reuse 的 `resolve_refresh_mode` ownership 冲突 | Open Questions / P0 Blocker 段显式 resolve，进入 U1/U2 依赖链。 |
| 现有 `command_shape_supported()` 硬编码 3 个 kind，未扩展 incremental 会打开未校验 CLI 执行边界或直接 emit_blocked | U2 Approach 显式要求扩展 shape gate + 校验循环；contract test 断言 incremental argv 的 shape 校验。 |
| incremental 失败后 raw log 按 kind 覆盖，审计证据丢失 | U2 扩展现有 `command_results[]` 加 `refresh_mode` / `attempt_role`（不引入独立 `bootstrap_attempts[]`），配合 provider-specific 独立 log 路径（GitNexus: `fallback-analyze.log`；CRG: `update.log` / `fallback-build.log`）；Scope Boundaries 明确接受此 debt（log redaction 不在本计划 scope）。 |
| dirty worktree 下索引含未提交内容但 last_indexed_commit 推进到 clean HEAD，造成下次 diff 窗口错位（incremental + full 都会触发） | R7 修复：(1) dirty incremental 强制降级 full；(2) dirty 任何刷新都不推进 last_indexed_commit；(3) 写入 requires_clean_full_refresh=true 状态位，强制下次 incremental preflight 降级直到 clean full 跑通才清除。状态机由本计划承担。 |
| 并发 bootstrap 运行（双 terminal / spec-work 间接触发）覆盖 per-provider status.json 造成 last_indexed_commit 撕裂 | 本计划不新增 repo-scoped lock；Target Operator / docs 明确不要并发运行同一仓库 bootstrap。真正的 lock / stale reclaim / doctor cleanup 移交独立并发治理计划。 |
| 混合失败语义：GitNexus 成功 / CRG 全失败时 refresh_modes_by_provider 值域不含 failed | R10 扩展 map 值域加 `failed`；不新增 summary 字段，consumer 需要精确判断时回读 per-provider status。 |
| Silent partial index drift：provider 在部分 parse 失败时仍 exit=0，readiness 三级证据通过但索引不完整 | U4 只证明 opt-in 单步 A→B 等价；默认仍为 `full`，且 repeated incremental 未验证。A→B→C→D 链、rename / parser degradation fuzz、以及 durable counter rotation / forced full cadence 属 default-switch follow-up plan；本计划不把这些机制放进 opt-in runtime contract。 |
| `last_indexed_commit` 被 CI / 恶意 PR 污染为 flag-shaped 字符串造成 argv injection | R6 对 status-derived `last_indexed_commit` 做 `^[0-9a-f]{40}$` 校验；projected `commands.incremental[4]` shape gate 只接受 sentinel，40-hex 固定 SHA 出现在 projected config 时必须 `emit_blocked unsupported-provider-command`。 |

---

## Documentation / Operational Notes

- **Rollout 范围（critical 边界）：** 本计划只交付 **incremental flag-gated operator escape hatch / expert opt-in**。U4 benchmark 是 **opt-in 正确性基线**（验证 incremental 在合成 diff 上正确且等价于 full），不是 default 切换的充分条件，也不代表普通 workflow 用户会自动获得 post-commit 加速。**Default 切换到 incremental** 需独立 follow-up rollout plan（覆盖 A→B→C→D 连续增量链 / 文件 rename / parser degradation fuzz / 长 commit 链累积误差等更宽 gate）。`DEFAULT_REFRESH_MODE_*` 在本计划范围内保持 `full` 不变。
- **回滚：** 本计划内无默认值回滚动作；出现问题时停止使用 / 停止推荐 `--incremental`，默认 full 继续生效，不回滚 schema/flag。未来 default-switch follow-up 落地后，才用单行修改相应 `DEFAULT_REFRESH_MODE_*` 常量回滚。
- **监控：** canonical artifacts 的 `readiness_source` 分布和 `fallback_from_incremental` 出现情况是运行期判断依据；跨 session 聚合属于 follow-up。
- **Opt-in 用户责任（确定性失败检测）：** 本计划不引入自动 failure circuit breaker。`--incremental` 是 expert opt-in，operator 只要观察到任一 `fallback_from_incremental=true`，就应主动停用 `--incremental`、改回默认 full，调查 provider / artifacts 后再显式重试。向 spec-first 仓库报 issue 时，只提供 `reason_code`、provider、fallback 是否出现 / 出现频率、脱敏摘录和本地 artifact 路径；禁止原样附任何 provider raw log 或未脱敏 URL。无此责任 / 不主动停用，opt-in 用户体验会持续比 status quo（纯 full）更慢——这是 opt-in 定位的显式 trade-off，不是产品 mechanism。
- **用户沟通：** README / 用户手册明确写成 explicit operator opt-in / expert escape hatch，只保留一句 Target Operator 边界；fallback 处理、redaction checklist 和 repeated-chain caveats 下沉到 graph-bootstrap 专项 validation / troubleshooting 或 consumption contract。`$spec-graph-bootstrap --help` 含 flag 文档，但不暗示普通 workflow 自动采用增量刷新。

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
