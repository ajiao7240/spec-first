---
title: "superseded: GitNexus storage failure repair preflight"
type: fix
status: superseded
date: 2026-05-09
spec_id: 2026-05-09-001-graph-bootstrap-gitnexus-repair-preflight
target_repo: spec-first
origin: "用户现场：GitNexus analyze 在 Windows 父级多仓 workspace 中因 .gitnexus/lbug Error 3 bootstrap failed"
---

# superseded: GitNexus storage failure repair preflight

## 概览

现场 `analyze.log` 显示 GitNexus 在 `analyze --force` 阶段失败：

```text
GitNexus: VECTOR extension load failed: IO exception: Cannot open file. path: <child-repo>/.gitnexus/lbug - Error 3
Analysis failed: COPY failed for File: IO exception: Cannot open file. path: <child-repo>/.gitnexus/lbug - Error 3
```

这不是 query proof 问题。GitNexus 尚未进入 `status` / `query_probe`，失败点是 repo-local `.gitnexus` index / vector extension storage。

本计划原本把恢复策略收敛为：**`spec-mcp-setup` 刷新 provider projection 之后，`spec-graph-bootstrap` 执行 GitNexus analyze 之前，提供显式 GitNexus repair preflight。**

后续源码审查和 npm package diff 证明，现场主要根因不是 spec-first 缺少 repair preflight，而是 `gitnexus@1.6.4-rc.85` 在 Windows forced reanalysis 复用既有 `.gitnexus/lbug` 时缺少 LadybugDB close/open retry 与 Windows handle-release probe。当前正确修复路径是使用 setup-owned provider pin `gitnexus@1.6.4` official stable（该 stable 替代曾用于 unblock 的 `gitnexus@1.6.4-rc.100`），并让 `spec-graph-bootstrap` 在旧 setup projection 时 fail closed，要求先重跑 `spec-mcp-setup`。本 repair 计划因此标记为 `superseded`；不要按本计划新增默认清理 `.gitnexus` 的主路径。

保留本文档的价值是记录当时对 destructive repair 的 safety 约束。只有在 **当前 bundled GitNexus package 已确认投影并仍然失败** 时，repair 才能作为 explicit human-scoped recovery 重新开 plan。

## 目标

- 为 GitNexus bootstrap storage/index failure 增加结构化分类。
- 在 `spec-graph-bootstrap` 中新增显式 GitNexus repair preflight，位置固定在 provider command validation 之后、GitNexus analyze 之前。
- repair 默认 preview，不删除；只有 explicit confirm 才删除。
- repair 删除范围仅限 child repo 内 `.gitnexus` 与 `.spec-first/providers/gitnexus`。
- repair 必须保护 symlink / junction / reparse point / path traversal / target ambiguity。
- repair 必须保留旧 raw log/status evidence，避免删除诊断证据。
- parent workspace no-arg repair preview 仍支持多仓默认 all-repos；真正执行删除的 confirm 阶段必须有显式 scope 或 preview token。
- Bash 与 PowerShell 行为保持 parity。
- 父 workspace 仍只写 advisory summary；child repo 仍拥有 canonical graph artifacts。

## 非目标

- 不在默认 `init` 阶段清理 `.gitnexus`。
- 不在默认 `spec-graph-bootstrap` 阶段自动清理 `.gitnexus`。
- 不 fork 或修复 GitNexus 内部 vector extension / DuckDB 行为。
- 不让脚本弹交互式确认问题。
- 不删除 `.spec-first/config/*`、`.spec-first/providers/code-review-graph`、`.spec-first/graph`、`.spec-first/impact`。
- 不把 live MCP 结果写回 compiled readiness。

## 事实判断

我不对当前策略给出“事实 100% 确信”。在实现、测试和 Windows 现场验证之前，任何计划都只能达到“无已知逻辑漏洞”。本计划把已识别漏洞全部转为可验证约束；事实置信度必须由实施后的测试和现场重跑关闭。

当前可确认事实：

- GitNexus `.gitnexus/lbug - Error 3` 发生在 `analyze` bootstrap 阶段。
- 旧策略若只给 `provider-command-failed`，诊断粒度不足。
- 清理 `.gitnexus` 是破坏性恢复动作，不能放在默认 `init` 或默认 bootstrap。
- 清理如果发生，应在 `spec-mcp-setup` projection 刷新之后、GitNexus analyze 之前。

## 漏洞审查与修正

| ID | 漏洞 | 风险 | 修正 |
|---|---|---|---|
| L1 | 默认 `init` 清理 `.gitnexus` | `init` 变成破坏性命令，且可能用旧 projection 重建 | 不放入默认 `init`；最多在 init summary 提示 repair |
| L2 | 默认 bootstrap 自动清理 | readiness compiler 产生隐式删除副作用 | repair 必须显式 flag；普通 bootstrap 不删除 |
| L3 | 脚本弹交互确认 | CI/headless 卡住，输出不可预测 | 交互确认在 workflow/agent 层；脚本只 preview/confirm |
| L4 | 父 workspace no-arg repair 被完全禁用 | 多仓开发模式退化，用户从 source/runtime skill 无参数运行时失去 workspace 维护入口 | preview 阶段保留 no-arg parent default all-repos；confirm 阶段才要求显式 `--all-repos` / `--repo` 或 preview token |
| L5 | symlink/junction/reparse point 被递归删除 | 删除 repo 外路径或用户数据 | repair 对目标路径做 lstat/reparse 检测；命中即 fail closed |
| L6 | path traversal / config 注入 | 删除非预期路径 | 删除路径只能由 repo root + 固定 literal suffix 生成，不读取 provider config 中的删除路径 |
| L7 | 删除前丢失旧 raw logs | 根因证据消失 | 删除前归档 `.spec-first/providers/gitnexus/raw/*`、`status.json` 到 repair run 目录 |
| L8 | 删除后脚本崩溃，旧 canonical graph facts 仍被误读 | downstream 消费 stale readiness | repair 写 `repair-status.json` crash marker；后续 resolver/bootstrap 看到未完成 marker 时 action-required 或覆盖为 failed |
| L9 | 并发 analyze/repair | index 半删除半写，失败更复杂 | repair 获取 child-local lock；拿不到 lock fail closed |
| L10 | setup projection 未刷新就清理 | 清理后仍用旧 GitNexus 版本重建 | repair 必须先验证 setup-owned inputs、provider command shape 与 package projection |
| L11 | no-source / unconfigured repo 也删除 | 无意义破坏 provider state | repair 仅对 GitNexus configured/enabled child 执行；no-source/unconfigured 记录 not-applicable |
| L12 | all-repos 部分 child repair 失败 | 汇总误判 ready/degraded | parent summary 保留 per-child repair result；失败 child action-required，其他 child 可继续 |
| L13 | PyPI/TLS CRG failure 与 GitNexus storage failure 混在一起 | 错误恢复动作 | CRG network 仍单独分类，不触发 GitNexus repair |
| L14 | preview 与 confirm 同时出现 | 语义不确定 | fail closed: `repair-preview-confirm-conflict` |
| L15 | confirm 未带 repair flag | 用户意图不明确 | fail closed: `repair-confirm-without-repair` |

## 需求追踪

- **R1**. GitNexus bootstrap 阶段出现 `.gitnexus` / `lbug` / `VECTOR extension load failed` / `COPY failed for File` / `Error 3` 时，当前实现输出 `reason_code=gitnexus-analyze-storage-write-failed`、`failure_class=provider-storage-write-failed`，同时保留 raw `analyze.log`。
- **R2**. GitNexus repair 只能在 setup-owned inputs 通过 schema/ledger/provider command validation 后进入 preview/confirm。
- **R3**. Repair 删除路径只允许 `.gitnexus` 与 `.spec-first/providers/gitnexus`。
- **R4**. Repair 必须 preview-first；无 confirm 时不删除。
- **R5**. 交互式 workflow 必须展示 preview 并取得用户确认后才调用 confirm。
- **R6**. 脚本/headless 模式不弹交互提示；无 confirm 只输出 action-required preview。
- **R7**. 父 workspace repair preview 必须保留 no-arg default all-repos；repair confirm 必须显式确认 scope，不能仅靠 no-arg 触发删除。
- **R8**. Repair 必须检测并拒绝 symlink / junction / reparse point 目标。
- **R9**. Repair 必须保留旧 GitNexus provider raw logs/status evidence。
- **R10**. Repair 必须使用 child-local lock 防止同一 repo 并发 repair/bootstrap。
- **R11**. Repair confirm 后继续执行原 provider bootstrap flow，并写最终 canonical artifacts。
- **R12**. Bash 与 PowerShell 参数、reason_code、输出字段和 safety guard 保持 parity。
- **R13**. 所有 source 变更同步 `CHANGELOG.md`。

## 关键决策

### D1. Repair 位于 setup 后、analyze 前

正确链路：

```text
spec-first init
  -> refresh parent/child host runtime assets

spec-mcp-setup
  -> refresh .spec-first/config/graph-providers.json
  -> refresh runtime-capabilities/provider-artifacts facts

spec-graph-bootstrap repair preflight
  -> validate setup-owned inputs
  -> validate GitNexus configured/enabled and command shape
  -> preview or confirm cleanup

spec-graph-bootstrap provider bootstrap
  -> GitNexus analyze/status/query_probe
  -> write canonical artifacts
```

`init` 不掌握 provider projection freshness，不能清理。默认 bootstrap 是 compiler，不应隐式删除。repair 是 bootstrap 前置的显式 preflight。

### D2. 参数模型

Bash:

```bash
bash .agents/skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh \
  --repo hs-kaz-crm-service \
  --repair-gitnexus-index \
  --preview-repair

bash .agents/skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh \
  --repo hs-kaz-crm-service \
  --repair-gitnexus-index \
  --confirm-repair
```

PowerShell:

```powershell
pwsh -File .agents\skills\spec-graph-bootstrap\scripts\bootstrap-providers.ps1 `
  -Repo hs-kaz-crm-service `
  -RepairGitNexusIndex `
  -PreviewRepair

pwsh -File .agents\skills\spec-graph-bootstrap\scripts\bootstrap-providers.ps1 `
  -Repo hs-kaz-crm-service `
  -RepairGitNexusIndex `
  -ConfirmRepair
```

Rules:

- `--repair-gitnexus-index` / `-RepairGitNexusIndex` without confirm defaults to preview.
- `--preview-repair` / `-PreviewRepair` is explicit preview alias.
- `--confirm-repair` / `-ConfirmRepair` must be paired with repair flag.
- preview and confirm cannot both be present.
- parent workspace repair preview keeps the normal no-arg default all-repos behavior.
- parent workspace repair confirm requires explicit destructive scope: `--repo`, `--all-repos`, or a preview token that records the exact target set.

### D3. Repair output schema

Preview/confirm result should be machine-readable and included in normal graph-bootstrap output:

```json
{
  "repair": {
    "schema_version": "gitnexus-repair-preflight.v1",
    "mode": "preview|confirm",
    "status": "action-required|completed|failed|not-applicable",
    "reason_code": "repair-preview-only|repair-completed|provider-index-path-unsafe|repair-lock-unavailable",
    "deleted_paths": [],
    "planned_delete_paths": [],
    "archived_evidence_path": ".spec-first/providers/gitnexus-repair/<run_id>/previous",
    "lock_path": ".spec-first/locks/gitnexus-repair.lock"
  }
}
```

Parent all-repos summary carries per-child `repair` result inside each child `result`; optional advisory `repair_counts` may be added.

### D4. Deletion safety

Deletion paths are generated only from fixed suffixes:

```text
<repo_root>/.gitnexus
<repo_root>/.spec-first/providers/gitnexus
```

Safety checks:

- The selected repo root must come from `resolve-project-target`.
- Resolve/canonicalize parent directories before deletion.
- Refuse deletion if target is outside repo root.
- Refuse deletion if target or any path component to delete is symlink/junction/reparse point.
- Refuse deletion if target resolves to repo root, `.git`, `.spec-first/config`, `.spec-first/graph`, `.spec-first/impact`, or provider other than GitNexus.
- Missing target paths are reported, not treated as failure.

### D5. Evidence preservation and crash consistency

Before confirm deletion:

- Create `.spec-first/providers/gitnexus-repair/<run_id>/`.
- Copy previous `.spec-first/providers/gitnexus/raw/*` and `status.json` into `previous/` when present.
- Write `repair-status.json` with `status=in-progress`.
- Acquire child-local lock before writing/deleting.

After confirm deletion:

- Write `repair-status.json` with `status=completed` or `status=failed`.
- Continue provider bootstrap.
- Final graph-bootstrap result must include repair result and provider result.

If a later run sees an old `repair-status.json` with `status=in-progress`, it should report `reason_code=gitnexus-repair-incomplete` and recommend rerunning repair/bootstrap; it must not silently trust stale canonical graph facts.

### D6. Failure classification

Add GitNexus bootstrap classifier before generic `provider-command-failed`:

```text
reason_code=gitnexus-analyze-storage-write-failed
failure_class=provider-storage-write-failed
failed_phase=bootstrap
```

Match only when `provider=gitnexus`, `phase=bootstrap`, and diagnostic contains `.gitnexus` or strong vector/COPY/lbug storage signals.

Extend provider network classifier for CRG/PyPI:

```text
reason_code=provider-network-unavailable
failure_class=provider-environment
```

Signals include `pypi.org`, `Failed to fetch`, `tls handshake eof`, `TLS`, `SSL`, `certificate`, `ETIMEDOUT`, `ECONNRESET`.

## 实施单元

### U1. GitNexus storage failure classification

Files:

- `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh`
- `skills/spec-graph-bootstrap/scripts/bootstrap-providers.ps1`
- `tests/unit/spec-graph-bootstrap.sh`
- `tests/unit/mcp-setup-powershell-contracts.test.js`

Add classifier and tests for `.gitnexus/lbug - Error 3`.

### U2. Repair argument parsing and conflict gates

Files:

- `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh`
- `skills/spec-graph-bootstrap/scripts/bootstrap-providers.ps1`
- `tests/unit/spec-graph-bootstrap.sh`

Add repair flags, conflict validation, preview-only behavior, and destructive confirm scope validation.

Test:

- repair confirm without repair flag fails.
- repair preview + confirm conflict fails.
- parent no-arg repair preview succeeds as default all-repos without deletion.
- parent no-arg repair confirm fails with `repair-confirm-scope-required` unless a matching preview token is supplied.
- parent explicit all-repos repair preview succeeds without deletion.

### U3. Safe path planner

Files:

- `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh`
- `skills/spec-graph-bootstrap/scripts/bootstrap-providers.ps1`
- `tests/unit/spec-graph-bootstrap.sh`

Build fixed-suffix deletion planner with containment checks and symlink/reparse point rejection.

Test:

- `.gitnexus` symlink/junction is rejected.
- missing `.gitnexus` is reported as missing, not failure.
- `.spec-first/providers/gitnexus` outside repo root via symlink is rejected.

### U4. Evidence archive, lock, and crash marker

Files:

- `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh`
- `skills/spec-graph-bootstrap/scripts/bootstrap-providers.ps1`
- `tests/unit/spec-graph-bootstrap.sh`

Add:

- `.spec-first/locks/gitnexus-repair.lock`
- `.spec-first/providers/gitnexus-repair/<run_id>/previous/`
- `.spec-first/providers/gitnexus-repair/<run_id>/repair-status.json`

Test:

- previous analyze/status/query logs are archived before deletion.
- lock contention fails closed.
- stale in-progress marker is reported on next run.

### U5. Confirm repair execution

Files:

- `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh`
- `skills/spec-graph-bootstrap/scripts/bootstrap-providers.ps1`
- `tests/unit/spec-graph-bootstrap.sh`

Implement deletion and continuation into existing bootstrap flow.

Test:

- confirm deletes only allowed paths.
- confirm then bootstrap writes fresh provider status.
- deletion failure stops before analyze and reports action-required.

### U6. Parent all-repos repair summary

Files:

- `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh`
- `skills/spec-graph-bootstrap/scripts/bootstrap-providers.ps1`
- `tests/unit/spec-graph-bootstrap.sh`

Ensure all-repos passes repair args to child runs and preserves partial success.

Test:

- one child repair unsafe, one child completed: parent summary is partial/action-required with per-child repair reasons.
- parent writes only `.spec-first/workspace/graph-bootstrap-summary.json`.

### U7. Skill/README runbook

Files:

- `skills/spec-graph-bootstrap/SKILL.md`
- `README.md`
- `README.zh-CN.md`

Document:

- repair placement: setup after, analyze before.
- workflow/agent confirmation responsibility.
- script preview/confirm semantics.
- deletion scope and non-deletion paths.
- single child first, all-repos second.

### U8. Changelog and validation

Files:

- `CHANGELOG.md`

Validation:

```bash
bash tests/unit/spec-graph-bootstrap.sh
npm run test:unit -- --runTestsByPath tests/unit/spec-graph-bootstrap-contracts.test.js tests/unit/mcp-setup-powershell-contracts.test.js
npm run typecheck
```

## 现场运行模型

1. Refresh runtime:

```powershell
spec-first init --codex -u leokuang --lang zh
```

2. Run `$spec-mcp-setup` to refresh provider projection.

3. Preview one child:

```powershell
pwsh -File .agents\skills\spec-graph-bootstrap\scripts\bootstrap-providers.ps1 `
  -Repo hs-kaz-crm-service `
  -RepairGitNexusIndex `
  -PreviewRepair
```

4. Agent shows planned deletion paths and asks user confirmation.

5. Confirm one child:

```powershell
pwsh -File .agents\skills\spec-graph-bootstrap\scripts\bootstrap-providers.ps1 `
  -Repo hs-kaz-crm-service `
  -RepairGitNexusIndex `
  -ConfirmRepair
```

6. If single child succeeds, preview all repos explicitly:

```powershell
pwsh -File .agents\skills\spec-graph-bootstrap\scripts\bootstrap-providers.ps1 `
  -AllRepos `
  -RepairGitNexusIndex `
  -PreviewRepair
```

7. Agent asks confirmation, then:

```powershell
pwsh -File .agents\skills\spec-graph-bootstrap\scripts\bootstrap-providers.ps1 `
  -AllRepos `
  -RepairGitNexusIndex `
  -ConfirmRepair
```

## Confidence gates

This strategy reaches plan-level confidence only when these are true:

- Every loophole in the table has a mapped implementation unit.
- Every destructive operation has preview-first and explicit confirm semantics.
- Every delete path is fixed-suffix, contained, and symlink/reparse-safe.
- Evidence is archived before deletion.
- Repair has lock and incomplete-run marker.
- all-repos repair preview can trigger from parent no-arg default; destructive confirm cannot trigger from parent no-arg alone.
- Bash and PowerShell tests cover the same reason codes and safety rules.

It reaches factual confidence only after:

- Unit tests pass.
- PowerShell contract tests pass.
- A Windows target workspace single-child repair succeeds.
- A Windows target workspace all-repos repair produces expected parent advisory summary.
- GitNexus either becomes ready/query-unverified with accurate diagnostics, or remains failed with `gitnexus-analyze-storage-write-failed` instead of generic `provider-command-failed`.

## Completion Criteria

- GitNexus `.gitnexus/lbug - Error 3` no longer produces generic `provider-command-failed`.
- Repair preview never deletes.
- Repair confirm deletes only `.gitnexus` and `.spec-first/providers/gitnexus`.
- Unsafe symlink/junction/reparse paths fail closed.
- Previous GitNexus raw logs/status are archived before deletion.
- Parent all-repos repair preview supports no-arg default; destructive confirm requires explicit `-AllRepos`, `--all-repos`, or a matching preview token.
- Final user-facing output distinguishes compiled readiness from live MCP evidence.
