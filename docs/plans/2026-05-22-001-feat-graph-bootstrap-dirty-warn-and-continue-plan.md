---
title: "feat: Graph Bootstrap Dirty Warn-and-Continue"
type: feat
status: completed
date: 2026-05-22
spec_id: 2026-05-22-002-graph-bootstrap-dirty-warn-and-continue
origin: docs/brainstorms/2026-05-22-002-graph-bootstrap-dirty-warn-and-continue-requirements.md
---

# feat: Graph Bootstrap Dirty Warn-and-Continue

## 摘要

移除 `bootstrap-providers.sh` / `.ps1` 对 `graph-affecting` dirty worktree 的 fail-closed 阻断，改为 warn-and-continue：GitNexus analyze 继续运行，dirty 状态写入 `freshness_state=dirty-advisory` 和 `overall_status=ready-dirty-advisory`，下游通过字段感知证据降级而不是被硬阻断。

完成状态：已落地 Bash / PowerShell 脚本、canonical artifact 字段、all-repos 汇总、SKILL.md、contract 文档与测试更新；`npm run test:unit` 于 2026-05-22 通过。

---

## Problem Frame

当前脚本在 `classify_worktree_dirty` 检测到 `graph-affecting-blocked` 后立即调用 `emit_blocked`，整个 bootstrap 中止。但 GitNexus analyze 直接索引磁盘文件，不依赖 git commit 状态——fail-closed 是 spec-first 的门卫，不是 GitNexus 的限制。

真实影响：7 个仓存在 graph-affecting dirty paths（AGENTS.md 用户区域、ops.conf 等），用户无法刷新任何 index，只能用过期 advisory evidence。

目标：dirty 只影响 freshness 标注，不阻断 analyze 执行。（见 origin: docs/brainstorms/2026-05-22-002-graph-bootstrap-dirty-warn-and-continue-requirements.md）

---

## Requirements

- R1. `graph-affecting` dirty worktree 不再 fail-closed；GitNexus analyze 继续运行
- R2. analyze 完成后写入 `dirty_classification=graph-affecting-blocked`（枚举值不变）、`freshness_state=dirty-advisory`、`source_revision_dirty=true`
- R3. bootstrap 输出包含高可见度 warning，列出 graph-affecting dirty paths（最多 20 条）
- R4. `overall_status` 写为 `ready-dirty-advisory`（新增枚举值）
- R5. 下游读取 `freshness_state=dirty-advisory` 时标注 `evidence_grade=advisory`
- R6. incremental + dirty 降级为 full refresh，写入 `refresh_mode=full-dirty-fallback`
- R7. concurrent-write detection 保持 fail-closed
- R8-R9. SKILL.md 和 contract 文档同步更新
- R10. 测试更新为新语义；legacy `dirty-source-blocked` 保留兼容读取
- R11. dirty AGENTS.md 进入 index 可接受（`--skip-agents-md` 只控制写入）
- R12. incremental + dirty → 降级 full
- R13. query proof 在 dirty-advisory 下仍运行

**Origin acceptance examples:** AE1-AE8（见 origin doc）

---

## Scope Boundaries

- 不改 code-review-graph provider 的 dirty 策略
- 不改 `setup-owned-only` / `non-graph-only` 的现有 pass-through 逻辑
- 不 bump `graph-facts.v1` schema version（additive 扩展）
- 不改 concurrent-write detection（仍然 fail-closed）
- 不改 GitNexus analyze 本身

---

## Graph Readiness

- target_repo: spec-first
- status: primary
- source_revision: current
- stale: false
- confidence: high（直接读取源码）

---

## Key Technical Decisions

1. **`freshness_state` 作为 additive 字段加入 `graph-facts.v1`**：consumer 缺失时回退到 `worktree_dirty` 判断，不 bump schema version。（source: confirmed）

2. **`dirty_classification` 枚举值保留 `graph-affecting-blocked`**：只改行为，不改枚举值命名，避免所有 consumer 更新。（source: confirmed）

3. **`overall_status=ready-dirty-advisory` 新增枚举值**：区别于 `ready`（clean）和 `degraded`（provider 失败）。all-repos 汇总逻辑需同步识别该值。（source: confirmed）

4. **incremental + dirty → 降级 full**：在 `classify_worktree_dirty` 之后、provider 命令执行之前，检测 `REQUEST_INCREMENTAL=true && DIRTY_CLASSIFICATION=graph-affecting-blocked`，强制 `INVOCATION_REFRESH_MODE=full`，写入 `refresh_mode=full-dirty-fallback`。（source: confirmed）

5. **query proof 仍然运行**：dirty-advisory 下 query proof 失败时 `query_ready=false`，`freshness_state` 保持 `dirty-advisory`，不引入新枚举。（source: confirmed）

---

## Implementation Units

### U1. 移除 Bash 脚本 fail-closed，改为 warn-and-continue

**Goal:** 让 `bootstrap-providers.sh` 在 `graph-affecting-blocked` 时继续执行而不是 `emit_blocked`。

**Requirements:** R1, R3, R6, R12

**Dependencies:** 无

**Files:**
- `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh`

**Approach:**
- 删除第 1201-1202 行的 `emit_blocked` 调用（`if [ "$DIRTY_CLASSIFICATION" = "graph-affecting-blocked" ]; then emit_blocked ...`）
- 在同位置改为：向 stderr 输出高可见度 warning，列出 `dirty_paths_breakdown` 中 graph-affecting paths（最多 20 条），说明 index 将基于当前未提交磁盘状态
- 在 `classify_worktree_dirty` 之后、`INVOCATION_REFRESH_MODE` 赋值之后，检测 `REQUEST_INCREMENTAL=true && DIRTY_CLASSIFICATION=graph-affecting-blocked`，强制 `INVOCATION_REFRESH_MODE=full`，设置 `DIRTY_INCREMENTAL_DOWNGRADE=true`

**Patterns to follow:**
- 参考 `setup-owned-only` 的 pass-through 路径（第 1082-1090 行）
- warning 格式参考现有 `emit_blocked` 的 next_action 文案风格

**Test scenarios:**
- 给定 AGENTS.md 用户区域 dirty，bootstrap 不返回 exit code 1，stdout 包含 `dirty_classification=graph-affecting-blocked`
- 给定 ops.conf dirty，bootstrap 继续执行，stderr 包含 dirty paths warning
- 给定 `--incremental` + dirty，`INVOCATION_REFRESH_MODE` 被强制为 full，输出包含 `refresh_mode=full-dirty-fallback`（Covers AE1, AE7）

**Verification:** `bash skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh` 在 dirty repo 下不返回 `dirty-source-blocked`，analyze 命令被执行

---

### U2. 写入 dirty-advisory canonical artifacts

**Goal:** analyze 完成后，`graph-facts.json` 和 `graph-bootstrap-result.v1` 包含 `freshness_state`、`source_revision_dirty`、`overall_status=ready-dirty-advisory`。

**Requirements:** R2, R4, R6

**Dependencies:** U1

**Files:**
- `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh`

**Approach:**
- 在 `graph-facts.json` 的 jq 构造（第 2894 行附近）中新增两个 additive 字段：
  - `freshness_state`：值为 `"fresh"`（clean）或 `"dirty-advisory"`（`DIRTY_CLASSIFICATION=graph-affecting-blocked`）
  - `source_revision_dirty`：值为 `true`（dirty-advisory）或 `false`（clean）
- `OVERALL_STATUS` 赋值逻辑（第 2801-2814 行）：在 `WORKFLOW_MODE=primary` 且 `DIRTY_CLASSIFICATION=graph-affecting-blocked` 时，将 `OVERALL_STATUS` 改为 `ready-dirty-advisory`（而不是 `ready`）
- `graph-bootstrap-result.v1` 的 jq 构造（第 3005 行附近）同步写入 `freshness_state` 和 `source_revision_dirty`
- `bootstrap-report.md` 新增 `freshness_state` 行
- `DIRTY_INCREMENTAL_DOWNGRADE=true` 时写入 `refresh_mode=full-dirty-fallback`（在 per-provider status 的 `refresh_mode` 字段）

**Patterns to follow:**
- 参考 `dirty_classification` 和 `dirty_paths_breakdown` 的现有写入方式（第 2888-2892 行）
- `freshness_state` 作为 additive 字段，consumer 缺失时回退到 `worktree_dirty` 判断

**Test scenarios:**
- dirty-advisory bootstrap 完成后，`graph-facts.json` 包含 `freshness_state=dirty-advisory`、`source_revision_dirty=true`（Covers AE3）
- clean bootstrap 完成后，`graph-facts.json` 包含 `freshness_state=fresh`、`source_revision_dirty=false`
- dirty-advisory bootstrap 的 stdout `overall_status=ready-dirty-advisory`（Covers AE2）
- incremental + dirty 完成后，per-provider status 包含 `refresh_mode=full-dirty-fallback`（Covers AE7）

**Verification:** `jq '.freshness_state' .spec-first/graph/graph-facts.json` 在 dirty repo 返回 `"dirty-advisory"`

---

### U3. PowerShell 脚本同步修改

**Goal:** `bootstrap-providers.ps1` 与 Bash 脚本行为一致。

**Requirements:** R1, R2, R4

**Dependencies:** U1, U2

**Files:**
- `skills/spec-graph-bootstrap/scripts/bootstrap-providers.ps1`

**Approach:**
- 找到 PS1 中对应 `graph-affecting-blocked` 的 fail-closed 逻辑，改为 warn-and-continue
- 同步写入 `freshness_state`、`source_revision_dirty`、`ready-dirty-advisory` overall_status
- incremental + dirty 降级逻辑同步

**Patterns to follow:** 参考 PS1 中 `setup-owned-only` 的 pass-through 路径

**Test scenarios:**
- PS1 在 dirty repo 下不返回 `dirty-source-blocked`（Covers AE1）
- PS1 dirty-advisory bootstrap 的 stdout 包含 `freshness_state=dirty-advisory`

**Verification:** `npm run test:unit` 中 PS1 dirty 相关用例通过

---

### U4. 更新 contract 文档和 SKILL.md

**Goal:** `graph-provider-consumption.md` 和 `SKILL.md` 反映新的 warn-and-continue 语义。

**Requirements:** R8, R9

**Dependencies:** U1, U2

**Files:**
- `docs/contracts/graph-provider-consumption.md`
- `skills/spec-graph-bootstrap/SKILL.md`

**Approach:**
- `graph-provider-consumption.md`：
  - dirty worktree 行为表格：`graph-affecting` 行从"provider commands 不运行"改为"GitNexus provider commands 运行，写入 dirty-advisory artifacts"
  - 新增 `freshness_state` 字段说明（additive，缺失时回退到 `worktree_dirty`）
  - 新增 `ready-dirty-advisory` overall_status 枚举说明
  - legacy `dirty-source-blocked` 兼容读取说明保留
- `SKILL.md`：
  - 第 271 行：更新 dirty worktree 行为描述（从 fail-closed 改为 warn-and-continue）
  - 第 283 行：移除"fail-closed and has no `--allow-dirty` escape hatch"，改为 warn-and-continue 语义

**Test scenarios:**
- `npm run test:unit` 中 `spec-graph-bootstrap-contracts.test.js` 通过（不再断言 fail-closed 行为）
- `graph-provider-consumption-contracts.test.js` 通过

**Verification:** `npm run test:unit` 全部通过

---

### U5. 更新单测

**Goal:** 现有断言 `dirty-source-blocked` / fail-closed 的测试用例更新为新语义。

**Requirements:** R10

**Dependencies:** U1, U2, U3, U4

**Files:**
- `tests/unit/spec-graph-bootstrap.sh`
- `tests/unit/spec-graph-bootstrap-contracts.test.js`
- `tests/unit/graph-provider-consumption-contracts.test.js`

**Approach:**
- `spec-graph-bootstrap.sh`：
  - 第 818 行：`host entry outside managed block` 断言从 `blocked:dirty-source-blocked:graph-affecting-blocked:true` 改为 `ready-dirty-advisory:graph-affecting-blocked:false`（analyze 运行，canonical artifacts 写入）
  - 第 846 行：`.gitignore outside managed block` 同上
  - 第 955、962 行：rename 相关 dirty 断言同步更新
  - 第 1004 行：dirty refresh 断言更新
  - 新增测试：dirty-advisory bootstrap 完成后 `graph-facts.json` 包含 `freshness_state=dirty-advisory`
  - 新增测试：incremental + dirty 降级为 full，`refresh_mode=full-dirty-fallback`
- `spec-graph-bootstrap-contracts.test.js`：移除对 `dirty-source-blocked` 的 fail-closed 断言，改为 warn-and-continue 断言
- `graph-provider-consumption-contracts.test.js`：更新 dirty worktree 行为断言

**Test scenarios:**
- 所有现有 dirty 相关测试更新后通过（Covers AE5）
- 新增 dirty-advisory 完成路径测试通过（Covers AE1, AE2, AE3）
- 新增 incremental + dirty 降级测试通过（Covers AE7）
- concurrent-write detection 测试不变，仍然 fail-closed（Covers AE4）

**Verification:** `npm run test:unit` 全部通过，无回归

---

## Risks

- **all-repos 汇总逻辑**：第 634-651 行的 all-repos `overall_status` 汇总使用 `select(.overall_status == "ready")` 计数。`ready-dirty-advisory` 不等于 `ready`，会被计入 `action_required`，导致汇总结果偏差。需要在 U2 中同步更新 all-repos 汇总逻辑，把 `ready-dirty-advisory` 计入 `ready` 桶或新增独立计数。

- **`PRESERVE_CANONICAL_FRESHNESS` 逻辑**：当前 `PRESERVE_CANONICAL_FRESHNESS=true` 时跳过 canonical artifact 写入。dirty-advisory 情况下 `PRESERVE_CANONICAL_FRESHNESS` 应为 `false`（需要写入新的 dirty-advisory artifacts），需确认该变量在 warn-and-continue 路径下的赋值不受影响。

---

## Deferred

- code-review-graph provider 的 dirty 策略（范围外，后续独立需求）
- 下游 workflow（spec-plan/spec-work/spec-code-review）消费 `freshness_state=dirty-advisory` 的具体 prose 更新（属于 GitNexus first-class capability plugin 需求的范围）

---

## Next Steps

-> `$spec-work docs/plans/2026-05-22-001-feat-graph-bootstrap-dirty-warn-and-continue-plan.md`
