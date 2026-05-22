---
date: 2026-05-22
topic: graph-bootstrap-dirty-warn-and-continue
spec_id: 2026-05-22-002-graph-bootstrap-dirty-warn-and-continue
---

# Graph Bootstrap Dirty Warn-and-Continue 需求

## 摘要

移除 `$spec-graph-bootstrap` 对 `graph-affecting` dirty worktree 的 fail-closed 阻断，改为 warn-and-continue：GitNexus analyze 直接索引当前磁盘文件，不依赖 git commit 状态；dirty 状态只影响 `freshness_state` 标注，不阻断 refresh 执行。

---

## 问题背景

当前 bootstrap 脚本在检测到 `graph-affecting` dirty paths（如 AGENTS.md 用户区域变更、ops.conf 等业务文件）时，直接 fail-closed：

```
reason_code=dirty-source-blocked
dirty_classification=graph-affecting-blocked
canonical_artifacts_preserved=true
```

用户被告知"commit、stash 或 clean 后再刷新"，整个 refresh 流程中断。

**但 GitNexus analyze 本身不依赖 git commit 状态**——它直接索引磁盘文件。fail-closed 是 spec-first 加的门卫，不是 GitNexus 的限制。

真实场景：7 个仓存在 graph-affecting dirty paths（AGENTS.md、ops.conf 等），用户无法刷新任何一个仓的 index，只能用过期的 advisory evidence，体验严重断裂。

目标：dirty worktree 只影响 freshness 标注（`freshness_state=dirty-advisory`），不阻断 analyze 执行。用户不需要提交代码就能获得基于当前磁盘状态的新鲜 index。

---

## 需求

**R1.** `graph-affecting` dirty worktree 不再 fail-closed；bootstrap 继续运行 GitNexus provider analyze 命令，索引当前磁盘文件。code-review-graph provider 的 dirty 策略不在本次范围内。

**R2.** analyze 完成后，canonical artifacts 写入 `dirty_classification=graph-affecting-blocked`（枚举值不变，只改行为）、`freshness_state=dirty-advisory`（新增 additive 字段，consumer 缺失时回退到 `worktree_dirty` 判断）、`worktree_dirty=true`、`worktree_status_hash=<当前 hash>`，下游消费者通过这些字段感知证据降级。

**R3.** bootstrap 输出必须包含高可见度 warning，列出 graph-affecting dirty paths（最多 20 条），说明 index 基于当前未提交磁盘状态，`source_revision` 不精确对齐。

**R4.** `overall_status` 在 dirty-advisory 情况下写为 `ready-dirty-advisory`（新增枚举值），区别于 `ready`（clean）和 `degraded`（provider 失败）。

**R5.** 下游 workflow（plan/work/review）读取 `freshness_state=dirty-advisory` 时，必须把 GitNexus evidence 标注为 `evidence_grade=advisory`，并要求结合当前源码直读验证关键结论。

**R6.** `source_revision` 字段在 dirty-advisory 情况下写入当前 HEAD commit hash，并附加 `source_revision_dirty=true`（新增 additive 字段），明确表示 index 内容可能超前于 HEAD。

**R7.** concurrent-write detection 保持 fail-closed：analyze 运行期间发生 concurrent write 时，写入 `reason_code=concurrent-write-detected` 并丢弃本轮 artifacts，不写入 dirty-advisory canonical artifacts。

**R8.** 移除 SKILL.md 中"fail-closed and has no `--allow-dirty` escape hatch"的表述，更新为 warn-and-continue 语义。

**R9.** `docs/contracts/graph-provider-consumption.md` 的 dirty worktree 行为表格更新：`graph-affecting` 行从"provider commands 不运行"改为"GitNexus provider commands 运行，写入 dirty-advisory artifacts；`dirty_classification` 枚举值保持 `graph-affecting-blocked`"。

**R10.** 现有测试中断言 `dirty-source-blocked` / `graph-affecting-blocked` 导致 fail-closed 的用例更新为新的 `ready-dirty-advisory` 语义；legacy `dirty-source-blocked` reason code 保留为兼容读取（历史 command result 不破坏），不再写出。

**R11.** dirty AGENTS.md 内容进入 GitNexus index 是可接受的：`--skip-agents-md` 参数控制 analyze 不覆写 AGENTS.md，不控制读取；dirty AGENTS.md 的 spec-first managed block 变更不影响代码语义，`dirty-advisory` 标注已足够提示下游，不需要在 analyze 前临时排除 AGENTS.md 内容。

**R12.** incremental refresh + dirty worktree 时，bootstrap 降级为 full refresh（不继续 incremental）：incremental 依赖 `last_indexed_commit` 精确对齐，dirty 状态下 commit 不精确，降级为 full 后写入 `freshness_state=dirty-advisory`、`refresh_mode=full-dirty-fallback`。

**R13.** dirty-advisory 情况下 query proof 阶段仍然运行；query proof 失败时 `query_ready=false`，`freshness_state` 保持 `dirty-advisory`，不引入新的 `dirty-advisory-unverified` 枚举——下游通过 `query_ready=false` + `freshness_state=dirty-advisory` 组合判断即可。

---

## 验收示例

**AE1（覆盖 R1、R2、R3）**：给定 AGENTS.md 用户区域有未提交变更，运行 bootstrap，GitNexus analyze 正常执行，输出包含 `dirty_classification=graph-affecting-blocked`、`freshness_state=dirty-advisory`、dirty paths warning，不返回 `dirty-source-blocked` reason code。

**AE2（覆盖 R4、R5）**：给定 dirty-advisory 完成的 bootstrap，下游 `$spec-plan` 读取 graph facts，GitNexus evidence 标注为 `evidence_grade=advisory`，plan 输出包含"index 基于未提交磁盘状态，关键结论需源码直读验证"的 limitation 说明。

**AE3（覆盖 R6）**：给定 dirty-advisory bootstrap 结果，`source_revision` 等于当前 HEAD，`source_revision_dirty=true`，下游不把它当作精确 commit 对齐的 fresh evidence。

**AE4（覆盖 R7）**：给定 dirty worktree 下 analyze 运行期间另一个进程写入文件，bootstrap 检测到 concurrent write，丢弃本轮 artifacts，返回 `reason_code=concurrent-write-detected`，不写入 dirty-advisory canonical artifacts。

**AE5（覆盖 R10）**：现有 dirty-source-blocked 测试用例更新后通过；历史 command result 里的 `dirty-source-blocked` reason_code 被 consumer 兼容读取为 legacy dirty-uncertain（canonical artifacts 不受影响，blocked 时本就不更新）。

**AE6（覆盖 R11）**：给定 AGENTS.md 有用户区域未提交变更，运行 bootstrap，analyze 使用 `--skip-agents-md` 参数正常执行，dirty AGENTS.md 内容进入 index，输出标注 `dirty-advisory`，不因 AGENTS.md dirty 额外阻断。

**AE7（覆盖 R12）**：给定 dirty worktree 下用户运行 `--incremental`，bootstrap 降级为 full refresh，输出包含 `refresh_mode=full-dirty-fallback`、`freshness_state=dirty-advisory`，不执行 incremental analyze。

**AE8（覆盖 R13）**：给定 dirty-advisory analyze 完成后 query proof 失败，输出包含 `query_ready=false`、`freshness_state=dirty-advisory`，下游通过两字段组合判断，不出现新枚举值。

---

## 成功标准

- 用户在 dirty worktree 下运行 bootstrap，GitNexus analyze 正常完成，获得基于当前磁盘状态的新鲜 index
- 下游 workflow 能区分 `fresh`、`dirty-advisory`、`stale`、`query-unverified` 四种 freshness 状态
- 不再出现"必须 commit/stash 才能 refresh"的硬阻断提示
- concurrent-write detection 仍然 fail-closed，不因 warn-and-continue 引入数据竞争
- 所有现有测试通过（dirty 相关用例更新语义后）

---

## 范围边界

**范围内：**
- `bootstrap-providers.sh` / `bootstrap-providers.ps1`：移除 GitNexus provider 的 fail-closed，改为 warn-and-continue
- `graph-facts.v1` schema：additive 扩展 `freshness_state`、`source_revision_dirty`、`ready-dirty-advisory` overall_status（不 bump schema version）
- `graph-provider-consumption.md` contract 更新
- `spec-graph-bootstrap` SKILL.md 更新
- 相关单测更新

**范围外：**
- GitNexus analyze 本身不需要改动
- `setup-owned-only` 和 `non-graph-only` 的现有 pass-through 逻辑不变
- concurrent-write detection 逻辑不变（仍然 fail-closed）
- code-review-graph provider 的 dirty 策略不变
- `$spec-mcp-setup` 不涉及

---

## 关键决策

- **warn-and-continue，不引入 `--allow-dirty` flag**：行为统一，不需要用户记忆额外参数
- **`ready-dirty-advisory` 新增 overall_status 枚举**：让下游能精确区分"成功但 dirty"和"成功且 clean"，不混用 `ready`
- **`dirty_classification` 枚举值保留 `graph-affecting-blocked`**：只改行为，不改枚举值命名，避免所有 consumer 更新
- **`freshness_state` 和 `source_revision_dirty` 作为 additive 字段加入 `graph-facts.v1`**：向后兼容，不 bump schema version；consumer 缺失该字段时回退到 `worktree_dirty` 判断
- **legacy `dirty-source-blocked` 保留兼容读取**：历史 command result 不破坏，consumer 把它视为 dirty-uncertain
- **concurrent-write detection 保持 fail-closed**：analyze 运行期间发生 concurrent write 时丢弃本轮 artifacts，不写入 dirty-advisory canonical artifacts
- **本次只改 GitNexus provider 的 dirty 行为**：code-review-graph provider 的 dirty 策略不在本次范围内
- **dirty AGENTS.md 内容进入 index 可接受**：`--skip-agents-md` 只控制写入不控制读取，managed block 变更不影响代码语义，`dirty-advisory` 标注已足够
- **incremental + dirty 降级为 full**：incremental 依赖精确 commit 对齐，dirty 状态下不可信，降级写入 `refresh_mode=full-dirty-fallback`
- **query proof 在 dirty-advisory 下仍运行**：失败时用 `query_ready=false` + `freshness_state=dirty-advisory` 组合表达，不引入新枚举值

---

## 改动面摘要

| 文件 | 改动类型 |
|---|---|
| `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh` | 移除 GitNexus fail-closed，写入 dirty-advisory artifacts |
| `skills/spec-graph-bootstrap/scripts/bootstrap-providers.ps1` | 同上（PowerShell） |
| `skills/spec-graph-bootstrap/SKILL.md` | 更新 dirty 行为描述，移除 fail-closed 表述 |
| `docs/contracts/graph-provider-consumption.md` | 更新 dirty worktree 行为表格，新增 `freshness_state` 字段说明 |
| `tests/unit/spec-graph-bootstrap.sh` | 更新 dirty-source-blocked 断言为 ready-dirty-advisory |
| `tests/unit/spec-graph-bootstrap-contracts.test.js` | 同上 |
| `tests/unit/graph-provider-consumption-contracts.test.js` | 同上 |

---

## Next Steps

-> `$spec-plan docs/brainstorms/2026-05-22-002-graph-bootstrap-dirty-warn-and-continue-requirements.md`
