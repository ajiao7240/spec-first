# Project Target v2 Git Health Diagnostics

## 结论

`project-target.v2` 是 setup target resolver 的兼容扩展，用来把 Git 拓扑失败从“静默吞掉”改成可消费的 deterministic facts。它不改变 source-of-truth 边界：父级 workspace 仍是 advisory-only，child repo 才拥有 repo-local `.spec-first/config/*`、`.spec-first/graph/*`、`.spec-first/providers/*` 和 `.spec-first/impact/*` canonical artifacts。

## Goals

- 区分 `ok`、`not-git`、`broken-worktree`、`corrupted-gitdir` 四类 Git 状态。
- 在 workspace 模式下暴露 `coverage_gap`，让用户知道哪些顶级目录没有被 child Git repo discovery 覆盖。
- 把 broken/corrupted child `.git` 目录放进 `candidates_diagnostics[]`，避免既不被索引也不被解释。
- 把诊断事实传到 readiness ledger v2 的 `parent_workspace_advisory`，供 LLM 和用户决定下一步。

## Non-Goals

- 不自动删除 `.git`，不自动修复 worktree。
- 不把 parent `.spec-first/config.local.yaml` 升级为 mixed topology 配置权威。
- 不新增默认 `workspace-mixed-topology` mode。
- 不让 `--all-repos` 自动追加 parent folder graph bootstrap。

## Artifact Contract

`resolve-project-target.{sh,ps1}` 输出 `schema_version="project-target.v2"`，并始终包含：

```json
{
  "schema_version": "project-target.v2",
  "git_health": {
    "status": "ok",
    "reason_code": "git-health-ok",
    "git_entry_type": "directory"
  }
}
```

`git_health.status` 闭集：

- `ok`: 当前目录是可用 Git repo、健康 worktree，或由 ancestor Git root 管辖。
- `not-git`: 当前目录没有本地 `.git` entry，也没有 ancestor Git root。
- `broken-worktree`: 本地 `.git` 是 `gitdir:` pointer 文件，但 pointer 目标不存在。
- `corrupted-gitdir`: 本地 `.git` 存在但不是可用 Git metadata。

仅 workspace 模式输出 `coverage_gap`：

```json
{
  "coverage_gap": {
    "uncovered_top_level_dirs": 3,
    "sample": ["app", "docs", "packages"],
    "ignored_dir_patterns": [".git", "node_modules", "vendor", "build"],
    "advisory": "Top-level folders are not automatically covered unless they are child Git repos or explicitly targeted as folders."
  }
}
```

当 child 目录含 broken/corrupted `.git` 时，resolver 输出 `candidates_diagnostics[]`，该 child 不进入 `candidate_roots`，也不计入 `coverage_gap`。

## Consumer Boundary

`detect-tools.{sh,ps1}` 透传 `git_health`、`coverage_gap`、`candidates_diagnostics`。`verify-tools.{sh,ps1}` 将这些事实写入 readiness ledger v2 的 `parent_workspace_advisory`：

```json
{
  "parent_workspace_advisory": {
    "git_health": {},
    "coverage_gap": {},
    "candidates_diagnostics": [],
    "repair_action_available": true,
    "repair_command": "spec-first repair-worktree --dry-run",
    "diagnostic_action_available": false,
    "diagnostic_command": null
  }
}
```

`parent_workspace_advisory` 不参与 `baseline_ready`。脚本只提供 facts、reason_code 和 command hints；是否修复、是否用 `--folder` workaround、是否另开 mixed topology follow-up 由 LLM 和用户判断。

## Repair Boundary

`spec-first repair-worktree --dry-run` 只处理 `broken-worktree` 的 preview：

- 打印当前 `.git` pointer 摘要。
- 打印 unlink preview 和手动修复建议。
- 提示可以显式使用 `--folder <path>` 作为 non-git-folder workaround。
- 对健康 repo、非 Git 目录、corrupted `.git` 拒绝给出 unlink preview。
- 对 `--apply` / `--unlink` fail closed，返回 `repair-worktree-apply-deferred`。

未来如果实现执行删除，必须另开 plan，并绑定 dry-run fingerprint/token，不能只凭“当前仍是 broken-worktree”就删除。
