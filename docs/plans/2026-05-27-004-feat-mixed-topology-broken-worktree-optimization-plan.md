---
title: "feat: 混合拓扑 + broken worktree 诊断诚实性优化"
type: feat
status: active
date: 2026-05-27
spec_id: 2026-05-27-002-mixed-topology-broken-worktree-optimization-proposal
origin: docs/brainstorms/2026-05-27-002-mixed-topology-broken-worktree-optimization-proposal.md
---

# feat: 混合拓扑 + broken worktree 诊断诚实性优化

## Summary

本计划分 P0/P1/Spike/P2 四阶段消除 spec-first 在「父级 git worktree 失效 + 混合拓扑工作区」场景下的诊断盲区：P0 让 `resolve-project-target` 区分 broken-worktree / corrupted-gitdir / not-git 三类 git 失败并暴露未覆盖目录计数；P1 新增 `spec-first repair-worktree` preview-first 修复子命令；Spike 在 P2 开发前验证 GitNexus multi-target label 唯一性及父级 folder 索引耗时；P2 接入 `.spec-first/config.local.yaml` 的 `workspace.additional_folder_targets[]` 配置，使 `bootstrap-providers --all-repos` 自动覆盖混合拓扑。核心判断是 `--folder` non-git-folder 模式已是 first-class 能力，缺的是诊断诚实性与配置驱动的拓扑表达。

---

## Problem Frame

工作区 `kaz-mvp` 拓扑：父级 `.git` 是指向已失效路径的 worktree pointer（82 字节文件），根目录下同时存在 6 个独立 child git repo 和 30+ 个非独立 git 业务模块。用户跑完 `/spec:mcp-setup` + `/spec:graph-bootstrap --all-repos` 后只看到"跑了 6 个"，不知道 30+ 个业务模块被完全跳过。

根本原因：`resolve-project-target.sh:114` 用 `2>/dev/null || true` 静默吞掉所有 git 失败，broken worktree、损坏 gitdir、真正非 git 三类情况无法区分；`discover_candidates` 的忽略列表与 `coverage_gap` 字段缺失；schema `project-target.v1` 没有 `git_health`、`coverage_gap`、`candidates_diagnostics` 诊断字段。`--folder` 路径存在但用户无从得知。

参考 origin: `docs/brainstorms/2026-05-27-002-mixed-topology-broken-worktree-optimization-proposal.md`

---

## Requirements

<!-- 注：mode 枚举中 workspace-no-git-candidates 是 resolve-project-target 的 output mode（workspace 发现到 0 child git repo）；non-git-folder 是 target_kind（用户显式 --folder 指定）；两者是不同层次的枚举值，不互相替换。 -->

**诊断诚实性（R1-R3）**

- R1. `resolve-project-target.{sh,ps1}` 在父级入口和 `discover_candidates` 内部区分 broken-worktree / corrupted-gitdir / not-git / ok 四态，输出 `git_health` 字段（schema `project-target.v2`）。
- R2. 仅在 `mode` 属于 `workspace-multi-repo / workspace-single-candidate / workspace-no-git-candidates / workspace-mixed-topology` 时 emit `coverage_gap`（含 `uncovered_top_level_dirs` 计数、`sample[]`、`ignored_dir_patterns`、`advisory` 文案）。`git-repo / non-git-folder / invalid-target` 模式不 emit。
- R3. `reason_code="workspace-target-required"` 的 `next_action` 按 `git_health.status` 分支：`broken-worktree` 推荐 `spec-first repair-worktree`，`corrupted-gitdir` 推荐 `git fsck`，`not-git` 保留现有文案。

**修复子命令（R4）**

- R4. 新增 `spec-first repair-worktree [--dry-run|--apply]`（默认 dry-run）；P1 只实现 `--unlink`；dry-run 输出含并发修改时间戳 advisory；`--apply` 前重检 `.git` 状态，状态变化时拒绝并退出 reason_code `repair-worktree-state-changed`。

**Readiness 集成（R5）**

- R5. `verify-tools.{sh,ps1}` 把 `git_health` / `coverage_gap` 写入 readiness ledger v2 的 `parent_workspace_advisory` 节点，不进入 `baseline_ready` 计算；`broken-worktree` 暴露 `repair_command`，`corrupted-gitdir` 暴露 `diagnostic_command`，两者不共用 `repair_action_available`。

**配置驱动拓扑（R6-R8）**

- R6. `.spec-first/config.local.yaml` 新增 `workspace.additional_folder_targets[]`，支持 `path / label / extra_exclude`；路径解析以 `workspace_root` 为基，拒绝 `..` 上溯和 workspace 外路径；`extra_exclude` 仅限简单前缀 + 末尾 `*`，不引入 glob 库；`computed_exclude` 自动合并 discovered child git roots + ignore list + user extra_exclude。
- R7. `resolve-project-target.{sh,ps1}` 优先级：CLI 显式参数 > cwd-git-root 自动选择 > workspace 配置 > 现有 workspace 模式；配置存在时 `mode` 输出 `workspace-mixed-topology`。注：CWD_GIT_ROOT 非空时忽略 workspace 配置；如 `config.local.yaml` 存在 `additional_folder_targets` 但被忽略，应在 `parent_workspace_advisory` 中输出 advisory 说明原因。
- R8. `bootstrap-providers.{sh,ps1}` all-repos loop 在 child loop 之后按 `additional_folder_targets[]` 追加 `--folder` 调用，传入 `computed_exclude`；写入 child-equivalent canonical artifacts；parent advisory summary 增 `additional_folder_targets[]` 节点。

**Origin actors:** A1 (Developer), A2 (spec-mcp-setup), A3 (spec-graph-bootstrap), A4 (using-spec-first — 已在 Deferred 段排除，不影响本计划实现范围), A5 (spec-first 维护者)

**Origin flows:** F1 (broken worktree 诊断暴露), F2 (coverage gap 可见性), F3 (修复指引 preview-first), F4 (显式拓扑配置覆盖), F5 (当前可用 workaround)

**Origin acceptance examples:**
- AE1: kaz-mvp broken-worktree → 诊断报告含 `git_health.status="broken-worktree"` + `coverage_gap.uncovered_top_level_dirs=35` + next_action repair-worktree 文案（covers R1, R2, R3）
- AE2: `spec-first repair-worktree --dry-run` 输出 unlink preview + 手动 git 修复建议两段（covers R4）
- AE3: `--apply` 重检状态变化时拒绝并退出 `repair-worktree-state-changed`（covers R4）
- AE4: `additional_folder_targets[{path:".", label:"kaz-mvp-parent"}]` 触发 `--all-repos` 覆盖 6 child + 1 parent folder（covers R6, R7, R8）

---

## Assumptions

- A1. schema v2 是 v1 的超集，已有消费者（`write-provider-config`、`verify-tools`、`bootstrap-providers`）按字段存在与否做降级，不对 `schema_version` 字面值做精确比较；可执行 source/test grep 确认 4 处硬编码：`resolve-project-target.sh:346`、`.sh:378`、`.ps1:99`，以及 `tests/unit/mcp-setup-powershell-contracts.test.js:134`（对 `.ps1` 源码的字面值断言）——均须更新到 `v2`。历史 docs 中对 `project-target.v1` 的旧 contract 引用不计入执行残留。
- A2. YAML 解析通过 Node helper sub-action (`node bin/spec-first.js internal parse-workspace-config <yaml-file>`) 输出 JSON 到 shell。Node 22 无原生 `node:yaml` 模块（`require('node:yaml')` 抛 `ERR_UNKNOWN_BUILTIN_MODULE`）；当前 `package.json` 未声明 `js-yaml` 生产依赖，因此 P2 默认实现一个明确定义的 `additional_folder_targets` YAML 子集解析器，不依赖 dev/transitive dependency 或 `yq`。如实现时改用 `js-yaml`，必须先把它加入 direct production dependency，并同步 build/package 验证。
- A3. `workspace-mixed-topology` 是新增 mode，旧消费者不识别时 fallback 到 `next_action` 提示升级 spec-first，不破坏现有流程。
- A4. `resolve-workspace-graph-targets.{sh,ps1}` 对 mode 做正向枚举（L528 / L545 处），需显式加入 `workspace-mixed-topology` 分支，否则新 mode 会被静默跳过（brainstorm 遗漏项，已在研究阶段发现）。
- A5. P2 开发依赖 Spike（U12）通过；Spike 失败则 R8 降级为文档引导手动分次调用，P2 整体延迟。

---

## Scope Boundaries

- P3 混合拓扑 first-class（graph-providers.json multi-target 数组、单次调用统一 child + folder）：改动面过大，等 ≥2 个组织再次报告同类痛点再启动。
- P3 `parent_role` 枚举扩展（monorepo / multi-repo-workspace / advisory-only）：仅在有真实需求时立项。
- P3 高级修复（`--convert-to-repo`、`--retarget-worktree`）：故障面超出 spec-first 诊断/引导职责，P1 只实现 `--unlink`，其余作为 dry-run 文案建议。
- GitNexus 1.6.5 native crash 兜底（hscomponents / userinfo Napi::Error）：上游 GitNexus 问题，本计划只在 P0 readiness ledger 多记录 `provider_runtime_advisory.crash_frequency` advisory 字段。
- 自动 broken worktree 修复：`repair-worktree` 永远 preview-first，spec-mcp-setup 不自动调用。
- A4 (`using-spec-first` guide-mode broken-worktree 推荐，actor A4）：已在 Deferred 段排除，不影响本计划实现范围；触发条件：P1 落地后有用户反馈 broken-worktree 导航困难，由维护者发起独立 plan。

### Deferred to Follow-Up Work

- `using-spec-first` guide-mode 在 broken-worktree 状态下推荐 `spec-first repair-worktree`（A4）：P1 落地后再根据用户反馈决策，独立 plan。
- `spec-first init` 交互式向导识别 broken worktree 并打印 advisory（OQ3）：折中方案（只检测打印，不自动调）待 P1 落地后决策。
- `workspace.additional_folder_targets[]` 数组上限（OQ6）：当前不限，P2 实测发现 N>3 时过载再加 schema 上限。
- `.spec-first/config.local.yaml` 配置版本字段（OQ7）：等首次破坏性变更再统一引入。

---

## Graph Readiness

- target_repo: spec-first
- status: stale
- source_revision: HEAD (leo-2026-05-27-gitnexus-update)
- current_revision: stale — dirty-advisory (graph-affecting-blocked)
- stale: true
- primary_providers: gitnexus
- degraded_providers: none
- fallback_capabilities: grep, Read
- runtime_mcp_evidence: graph-facts.json query_global_graph=true; freshness=stale; dirty_classification=graph-affecting-blocked
- confidence: medium — snapshot 可用于 definition 查找，但 process graph / impact / related tests 不可信
- limitations: snapshot_mismatch, definitions_only_no_process_graph, definitions_only_no_impact_evidence, definitions_only_no_related_tests

---

## Graph / GitNexus Evidence

- provider: GitNexus
- native_tool_or_resource: graph-facts.json (`.spec-first/graph/graph-facts.json`)
- repo_scope: spec-first
- capability_status: partial
- evidence_grade: stale
- evidence_posture: fallback
- freshness_state: stale
- source_tags: [checked-in-baseline, session-local-inference]
- source_contract_fields: query_global_graph, freshness, dirty_classification, primary_providers
- source_reads_required: `skills/spec-mcp-setup/scripts/resolve-project-target.sh`, `skills/spec-mcp-setup/scripts/verify-tools.sh`, `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh`, `skills/spec-graph-bootstrap/scripts/resolve-workspace-graph-targets.sh`
- impact_on_plan: 研究阶段已通过直接 Read + grep 确认所有关键 line number；GitNexus impact graph 不可信，未用于 impact 分析
- capabilities_used: definition lookup (partial)
- key_findings: graph snapshot stale + dirty；所有关键触点已通过源码读取直接确认
- limitations: definitions_only_no_process_graph, definitions_only_no_impact_evidence, definitions_only_no_related_tests

---

## Context & Research

### Relevant Code and Patterns

- `skills/spec-mcp-setup/scripts/resolve-project-target.sh:114` — `CWD_GIT_ROOT` 判断，当前静默吞掉所有 git 失败
- `skills/spec-mcp-setup/scripts/resolve-project-target.sh:148-191` — `discover_candidates()`，只列独立 git repo，忽略列表 L163-167 缺 `build`
- `skills/spec-mcp-setup/scripts/resolve-project-target.sh:230-239` — 已有 `non-git-folder` mode first-class 分支
- `skills/spec-mcp-setup/scripts/resolve-project-target.sh:346, 378` — `project-target.v1` 硬编码（.sh 两处）
- `skills/spec-mcp-setup/scripts/resolve-project-target.ps1:99` — `project-target.v1` 硬编码（.ps1 一处）
- `skills/spec-mcp-setup/scripts/verify-tools.sh:360` — `($tools_ready and $helper_ready) as $baseline_ready` — `parent_workspace_advisory` 必须绕过此处
- `skills/spec-mcp-setup/scripts/verify-tools.sh:362-407` — readiness ledger v2 emit 位置
- `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh:632-657` — all-repos child loop；`--folder` 追加调用在此之后插入
- `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh:810/1310/1322/2009` — 已有 `TARGET_KIND="non-git-folder"` first-class 分支
- `skills/spec-graph-bootstrap/scripts/resolve-workspace-graph-targets.sh:528` — mode 正向枚举 `workspace-multi-repo`（.ps1:545）；需显式加 `workspace-mixed-topology`
- `skills/spec-mcp-setup/scripts/detect-tools.sh` — 已调用 `resolve-project-target --format json`，是 `git_health / coverage_gap` 进入 preflight JSON 的透传路径
- `skills/spec-mcp-setup/scripts/check-health` — 无 `.sh` 后缀（brainstorm typo），独立 preflight health 检查；不作为 `git_health` 字段传递路径
- `skills/spec-mcp-setup/references/config-template.yaml` — workspace 配置源（brainstorm 误写为 `templates/spec-first/config.local.example.yaml`，实际运行时产物为 `.spec-first/config.local.example.yaml`）
- `src/cli/index.js` — CLI if-cascade 路由，`repair-worktree` 分支模式
- `src/cli/commands/` — 现有 `clean.js / doctor.js / init.js / internal.js / session.js / tasks.js`，`repair-worktree.js` 新增
- `tests/unit/spec-graph-bootstrap.sh:446` — broken-worktree fixture 模式，可复用

### Institutional Learnings

- `docs/solutions/` — spec-first source-only 原则：不手改 generated runtime mirror；source 变更后用 `spec-first init` 修复 runtime drift
- preview-first 原则：写操作永远先给用户 dry-run 预览，`--apply` 才真正执行

### External References

- GitNexus `analyze --skip-git` 支持 non-git folder 索引（已在 2026-05-25-001 gitnexus-only-graph-provider 需求文档确认）
- `docs/brainstorms/2026-05-27-002-mixed-topology-broken-worktree-optimization-proposal.md` — 源 brainstorm v0.2（R-ID、F-ID、A-ID 来源）

---

## Key Technical Decisions

- **schema v2 是 v1 的超集，backward-compat**：已有消费者按字段存在/缺失降级，不校验 `schema_version` 字面值；全仓 4 处硬编码需更新（含 `tests/unit/mcp-setup-powershell-contracts.test.js:134` 字面值断言）。
- **共享忽略列表变量**：`discover_candidates` 的 case 模式和 `coverage_gap.ignored_dir_patterns` 引用同一 shell 变量（加入 `build`），避免未来分叉。
- **YAML 解析用 Node helper + 明确定义子集解析器**：`node bin/spec-first.js internal parse-workspace-config <yaml-file>` 输出 JSON；不依赖 `yq`、Node 内建 YAML 或未声明的 transitive dependency。默认实现针对 `additional_folder_targets` 层级的明确定义 YAML 子集解析器；如改用 `js-yaml`，必须先加入 direct production dependency（参见 Assumption A2）。
- **`workspace-mixed-topology` 作为独立 mode**：不合并进现有 `workspace-multi-repo`，使下游消费者有明确的 mode 值区分双轨处理场景。
- **`resolve-workspace-graph-targets.{sh,ps1}` 需显式加 `workspace-mixed-topology` 分支**：当前 mode 正向枚举会静默跳过新 mode（brainstorm 遗漏项，研究阶段补入 P2 文件列表）。
- **Spike 是 P2 硬前置**：GitNexus multi-target label 行为不验证，P2 不开发；Spike 失败则 R8 降级为文档引导手动分次调用。
- **dry-run 并发修改重检**：`--apply` 前重检 `.git` 状态；两次检测之间外部修改 `.git` 时拒绝执行，退出 `repair-worktree-state-changed`，提示重跑 dry-run。
- **`parent_workspace_advisory` 不进 `baseline_ready`**：`verify-tools.sh:360` 的 `$baseline_ready` 只由 `$tools_ready and $helper_ready` 决定，advisory 节点不阻塞下游 workflow。

---

## Open Questions

### Resolved During Planning

- **GitNexus non-git folder 在 multi-target 场景下的 label 唯一性**：升级为 P2 前置 Spike（U12）；Spike 失败则 R8 降级。
- **broken-worktree 检测在 Windows PowerShell 下的实现**：已下沉到 R1 + U2；`.git` 文件解析须 CRLF 规范化 + 反斜杠路径处理，fixture case 已列入 U7。
- **P2 exclude pattern 形式**：已下沉到 R6——简单相对路径前缀 + 末尾 `*` 通配，不支持 `**`，不引入 glob 库。
- **混合拓扑 GitNexus 索引时间预估**：已升级为 P2 前置实测（U12）；>5 分钟触发耗时 advisory，>15 分钟触发二次设计讨论。

### Resolved During Follow-Up Review (2026-05-27)

- **U6 数据流路径选择（低边际成本，高确定性）**：选择路径 A。`detect-tools.{sh,ps1}` 已调用 `resolve-project-target`，P0 只需透传新增字段给 `verify-tools.{sh,ps1}`；不让 `verify-tools` 额外再跑一次 resolver，避免重复诊断和竞态窗口。
- **`repair_action_available` 语义收窄（低边际成本，高确定性）**：仅 `broken-worktree` 为 true 并暴露 `repair_command="spec-first repair-worktree --dry-run"`；`corrupted-gitdir` 改走 `diagnostic_action_available` / `diagnostic_command="git fsck"`，避免把不能由 `repair-worktree` 处理的状态标成可修复。
- **U12 spike 命令形状修正（低边际成本，高确定性）**：当前 `bootstrap-providers.sh` 禁止 `--repo` 与 `--folder` 同次调用；spike 改为同一 workspace 下多次顺序调用 child repo 与 parent folder target，并比较 `.gitnexus/meta.json` / canonical artifacts 是否互相覆盖。
- **U13 YAML parser 依赖决策（低边际成本，中等实现成本）**：不依赖未声明的 transitive `js-yaml`；默认实现明确定义的 YAML 子集解析器。只有显式加入 direct dependency 时才可改用 `js-yaml`。
- **P1 状态写入风险口径修正（低边际成本，高确定性）**：P0 只读；P1 的 `repair-worktree --apply` 是显式受限写操作，不再把整个 P0/P1 描述为无状态写入风险。
- **`project-target.v1` grep 范围收窄（低边际成本，高确定性）**：执行验证只要求 `skills/`、`src/`、`tests/` 中无旧 schema emit / 字面值消费者残留；历史计划、brainstorm 和本计划中的旧 contract 引用允许保留或加说明。

### Deferred to Implementation

- **`spec-first init` 向导是否检测 broken worktree 并打印 advisory（OQ3）**：折中方案（只检测打印，不自动调 repair-worktree）可行，但具体文案需 P1 落地后结合用户反馈决定。
- **`additional_folder_targets[]` 数组上限（OQ6）**：P2 实测发现 N>3 时 readiness ledger / bootstrap loop 输出过载再考虑加 schema 上限。
- **`.spec-first/config.local.yaml` 配置版本字段（OQ7）**：等首次破坏性变更再统一引入。

### Deferred from doc-review (2026-05-27)

- **P2 Spike gate 过宽（doc-review P1-7）**：Spike 目前门控整个 P2（U13-U16）。可评估将 U13/U14 与 Spike 并行推进，只让 U15 等待 Spike 结论，减少 Spike 失败时的全面阻塞。决策时参考 U12 Spike 文档结论。
- **U15 --label + computed_exclude 接口设计（doc-review P2-1）**：`bootstrap-providers.sh` 当前无 `--label` 参数，`computed_exclude` 传递机制未定义。应在 U12 Spike 文档中包含 `u15_interface_proposal` 字段作为强制产出，U15 实现依赖该设计。
- **U15 CANDIDATE_COUNT=0 gate bypass（doc-review P2-2）**：`bootstrap-providers.sh:L593` 在 0 child git repo 时 exit 1，阻塞 folder-only 拓扑。已在 U15 Approach 中记录 bypass 要求；P2 测试场景需包含 0-child + 1-folder fixture。
- **workspace-mixed-topology 是否需要独立 mode（doc-review P2-3）**：当前唯一消费者 `resolve-workspace-graph-targets.sh` 对新 mode 与 `workspace-multi-repo` 走同一处理路径，独立 mode 的必要性有待评估。实现 U14 前可再次确认：是否可以在 `workspace-multi-repo` 上叠加 `additional_folder_targets` 字段而无需新 mode 字符串。

---

## High-Level Technical Design

> *方向性引导，不是实现规范。实现者按需调整。*

### P0/P1/P2 依赖关系

```
P0 ─────────────────────────────────────────► P1
 │  (R1 broken-worktree detection)              │  (R4 repair-worktree cmd)
 │  (R2 coverage_gap)                           │  (depends on P0 detect_git_health)
 │  (R5 readiness ledger advisory)              │
 └─────────────────────────────────────────────►│
                                                 │
P0 + P1 done ──────────────────────────────► Spike (U12)
                                                 │
                                      ┌──────────┘
                                      │  (GitNexus label uniqueness verified)
                                      │  (perf measurement done)
                                      ▼
                                     P2
                               (R6 YAML config)
                               (R7 workspace-mixed-topology mode)
                               (R8 bootstrap folder calls)
```

### detect_git_health() 四态状态机

```
input: <dir>
  │
  ├─ has no .git entry?              → status: "not-git"
  │
  ├─ .git is file?
  │   ├─ read first line → "gitdir: <ptr>"
  │   │   ├─ <ptr> exists?           → status: "ok" (healthy worktree)
  │   │   └─ <ptr> missing?          → status: "broken-worktree"
  │   │                                 emit worktree_pointer.exists=false
  │   └─ cannot parse as gitdir:     → status: "corrupted-gitdir"
  │
  └─ .git is directory?
      ├─ git rev-parse succeeds?     → status: "ok"
      └─ git rev-parse fails?        → status: "corrupted-gitdir"
```

### workspace.additional_folder_targets[] YAML schema（伪语法）

```
workspace:
  additional_folder_targets:
    - path: string          # "." | relative | absolute; 必须在 workspace_root 内，拒绝 ".." 上溯
      label: string         # 显式指定，避免和 child git repo label 冲突
      extra_exclude:        # optional; 简单前缀 + 末尾 * 通配，不支持 **
        - string
```

computed_exclude（脚本确定性工作）：
```
final_exclude = discovered_child_git_roots
              ∪ IGNORE_LIST (含 build)
              ∪ user_extra_exclude
```

---

## Implementation Units

### U1. detect_git_health() — resolve-project-target.sh

**Goal:** 在 `.sh` 中提取 `detect_git_health()` 函数，识别 broken-worktree / corrupted-gitdir / not-git / ok 四态；替换 L114 的静默 `2>/dev/null || true`；`discover_candidates` 内部对 broken child 记录 `candidates_diagnostics[]`，不进 `candidate_roots`。

**Requirements:** R1

**Dependencies:** None

**Files:**
- Create: `skills/spec-mcp-setup/scripts/lib-git-health.sh`（提取为可 source 的纯函数库，仅含 `detect_git_health()` 及相关辅助函数，无顶层副作用）
- Modify: `skills/spec-mcp-setup/scripts/resolve-project-target.sh`

**Approach:**
- 将 `detect_git_health()` 函数提取到新建 `lib-git-health.sh`（纯函数库，无参数解析循环和 exit 调用），供 resolve-project-target.sh 和 repair-worktree.sh 双方 source
- `resolve-project-target.sh` 顶部 `source "$SCRIPT_DIR/lib-git-health.sh"`
- 替换 L114 使用 `detect_git_health "$INVOCATION_CWD"`
- 在 `discover_candidates` 循环（L148-191）内，对有 `.git` 但 `git rev-parse` 失败的 child 调用 `detect_git_health`，将诊断结果追加到 `candidates_diagnostics[]` 数组变量，不进 `candidate_roots`
- `candidates_diagnostics` 只在非空时输出

**Patterns to follow:**
- `skills/spec-graph-bootstrap/scripts/resolve-workspace-graph-targets.sh:528` — mode 分支模式
- `tests/unit/spec-graph-bootstrap.sh:446` — broken-worktree fixture 模式

**Test scenarios:**
- Happy path: `.git` 目录 + `git rev-parse` 成功 → `git_health.status="ok"`
- Edge case: `.git` 是文件，内容 `gitdir: /missing/path` → `status="broken-worktree"`, `worktree_pointer.exists=false`
- Edge case: `.git` 是目录但 HEAD 缺失 → `status="corrupted-gitdir"`
- Edge case: 无 `.git` → `status="not-git"`
- Error path: child 子目录有 broken `.git` → 不进 `candidate_roots`，出现在 `candidates_diagnostics[]`

**Verification:**
- 现有 workspace-multi-repo 和 git-repo 用例全部通过
- 新增 broken-worktree fixture 验证 `git_health.status="broken-worktree"` 和 `worktree_pointer.exists=false`
- `candidates_diagnostics` 仅在有 broken/corrupted child 时出现

---

### U2. detect_git_health() — resolve-project-target.ps1

**Goal:** 与 U1 同步实现 `.ps1` 版 `detect_git_health`，处理 CRLF 规范化和 Windows 反斜杠路径。

**Requirements:** R1

**Dependencies:** U1（逻辑已在 U1 明确，.ps1 同步实现）

**Files:**
- Modify: `skills/spec-mcp-setup/scripts/resolve-project-target.ps1`

**Approach:**
- 读取 `.git` 文件时 trim CRLF（`[System.IO.File]::ReadAllText` + `.TrimEnd(['\r','\n'])`）
- 路径解析时将 `\` 规范化为 `/`，对 `gitdir: C:\Users\...` 格式验证目标路径
- `schema_version` 硬编码处（L99）更新为 `project-target.v2`

**Test scenarios:**
- Edge case: `.git` 文件内容 `gitdir: C:\Users\foo\.git\worktrees\bar\r\n` → `status="broken-worktree"` + 路径规范化后 exists=false

**Verification:**
- Windows 路径解析 fixture 通过
- CRLF fixture 通过

---

### U3. 共享忽略列表 + compute_coverage_gap() — resolve-project-target.sh

**Goal:** 把 `discover_candidates` 的 case 模式（L163-167）提取为共享 shell 变量，加入 `build`；新增 `compute_coverage_gap()` 函数，在 workspace 模式下扫描顶级未覆盖目录并输出 `coverage_gap` 字段。

**Requirements:** R2

**Dependencies:** U1（`discover_candidates` 完成后才能计算 coverage_gap）

**Files:**
- Modify: `skills/spec-mcp-setup/scripts/resolve-project-target.sh`

**Approach:**
- 提取 `IGNORE_DIR_PATTERN`（或等价 shell 数组）覆盖 L163-167 的 case 模式
- `IGNORE_DIR_PATTERN` 包含 `.git node_modules vendor .claude .codex .agents .spec-first build .cache .direnv .venv`
- `compute_coverage_gap()` 在 `discover_candidates` 之后运行，遍历顶级目录，排除 child git roots + IGNORE_DIR_PATTERN，计数 + 取前 7 个字典序 sample
- 按 R2 emit 条件决定是否将 coverage_gap 写入输出；`git-repo / non-git-folder / invalid-target` 模式不 emit

**Test scenarios:**
- Happy path: 父级有 35 个非 git 顶级目录 + 6 child git repo → `uncovered_top_level_dirs=35`，sample 前 7 个，child git roots 不出现在 sample
- Edge case: `build` 目录在父级 → 不出现在 uncovered_top_level_dirs（被 IGNORE_DIR_PATTERN 过滤）
- Integration: `discover_candidates` 的 case 语句和 `coverage_gap.ignored_dir_patterns` 引用同一变量，两者对 `build` 行为一致

**Verification:**
- `IGNORE_DIR_PATTERN` 被 `discover_candidates` 和 `compute_coverage_gap` 两处引用（可 grep 验证）
- git-repo / non-git-folder 模式下 `coverage_gap` 不出现在输出

---

### U4. 共享忽略列表 + coverage_gap — resolve-project-target.ps1

**Goal:** 与 U3 同步实现 `.ps1` 版共享忽略列表和 `coverage_gap` 计算。

**Requirements:** R2

**Dependencies:** U3（逻辑已明确）

**Files:**
- Modify: `skills/spec-mcp-setup/scripts/resolve-project-target.ps1`

**Verification:**
- .ps1 与 .sh 的 `ignored_dir_patterns` 输出一致

---

### U5. schema v2 emit + next_action 分支 — resolve-project-target.sh/.ps1

**Goal:** `schema_version` 硬编码由 `v1` 更新为 `v2`；emit `git_health` / `coverage_gap` / `candidates_diagnostics`；`next_action` 按 `git_health.status` 分支输出文案；前置可执行 source/test schema_version 影响面 grep 并输出到 plan 注释。

**Requirements:** R1, R2, R3

**Dependencies:** U1, U2, U3, U4

**Files:**
- Modify: `skills/spec-mcp-setup/scripts/resolve-project-target.sh` (L346, L378)
- Modify: `skills/spec-mcp-setup/scripts/resolve-project-target.ps1` (L99)
- Modify: `tests/unit/mcp-setup-powershell-contracts.test.js` (L134：将字面值断言从 `project-target.v1` 更新为 `project-target.v2`)

**Approach:**
- 在 `skills/`、`src/`、`tests/` 下 grep `"project-target\.v1"` 确认执行影响面（已知 4 处；如发现其他消费者做字面值比较，按"接受 v2 超集"或"显式版本判断"二选一处理）
- 更新 4 处硬编码（含 contract test）
- 在 emit 函数中按 R2 emit 条件条件性输出 `coverage_gap`；始终 emit `git_health`（含 status）
- `next_action` 按 git_health.status 三分支：broken-worktree / corrupted-gitdir / not-git（不变）

**Test scenarios:**
- Happy path: output JSON 含 `schema_version="project-target.v2"` 和 `git_health.status`
- Edge case: broken-worktree → next_action 含 `spec-first repair-worktree`
- Edge case: corrupted-gitdir → next_action 含 `git fsck`

**Verification:**
- `rg "project-target\.v1" skills src tests` 无旧 schema emit / 字面值消费者残留；历史 docs 中对旧 contract 的引用允许保留

---

### U6. readiness ledger v2 parent_workspace_advisory — detect-tools + verify-tools

**Goal:** `detect-tools.{sh,ps1}` 将 `resolve-project-target` 的 `git_health / coverage_gap / candidates_diagnostics` 透传进 preflight JSON；`verify-tools.{sh,ps1}` 在 readiness ledger v2 中新增 `parent_workspace_advisory` 节点（含 `git_health / coverage_gap / candidates_diagnostics / repair_action_available / repair_command / diagnostic_action_available / diagnostic_command`），不进入 `baseline_ready` 计算。

**Requirements:** R5

**Dependencies:** U5

**Files:**
- Modify: `skills/spec-mcp-setup/scripts/detect-tools.sh`
- Modify: `skills/spec-mcp-setup/scripts/detect-tools.ps1`
- Modify: `skills/spec-mcp-setup/scripts/verify-tools.sh`
- Modify: `skills/spec-mcp-setup/scripts/verify-tools.ps1`

**Approach:**
- 采用路径 A：`detect-tools.{sh,ps1}` 已调用 `resolve-project-target --format json`，在 `$FACTS_JSON` 中透传 `git_health / coverage_gap / candidates_diagnostics / additional_folder_targets_ignored_advisory` 等新增字段
- `check-health` 仍保留独立 preflight health 检查，不作为 git_health 字段传递路径，本计划不修改它
- `verify-tools.{sh,ps1}` 在 readiness ledger emit 段从 `$facts` 读取新增字段并构建 `parent_workspace_advisory` 对象；L360 的 `$baseline_ready` 计算不改动
- `repair_action_available=true` 当且仅当 `git_health.status == "broken-worktree"`；对应 `repair_command="spec-first repair-worktree --dry-run"`
- `diagnostic_action_available=true` 当且仅当 `git_health.status == "corrupted-gitdir"`；对应 `diagnostic_command="git fsck"` 或平台等价建议

**Test scenarios:**
- Integration: broken-worktree workspace → readiness ledger 含 `parent_workspace_advisory.git_health.status="broken-worktree"`，`baseline_ready` 仍为 `true`（tools 就绪时）
- Integration: corrupted-gitdir workspace → `repair_action_available=false`，`diagnostic_action_available=true`，next action 指向 `git fsck`
- Edge case: healthy workspace → `parent_workspace_advisory` 出现但 `git_health.status="ok"`，`coverage_gap` 仅在 workspace 模式下出现

**Verification:**
- `baseline_ready` 计算路径（L360）无改动，现有 setup 验证用例全通过
- `detect-tools` 输出的 preflight JSON 含 `git_health / coverage_gap`；`verify-tools` 输出的 readiness ledger 含 `parent_workspace_advisory` 节点

---

### U7. P0 contract tests + SKILL.md + docs

**Goal:** P0 所有新行为的 contract / integration 测试；`skills/spec-mcp-setup/SKILL.md` 补充 git_health / coverage_gap / candidates_diagnostics / 扩展 next_action 语义说明；用户手册和架构文档同步。

**Requirements:** R1, R2, R3, R5

**Dependencies:** U1–U6

**Files:**
- Create / Modify: `tests/integration/spec-mcp-setup/broken-worktree-*.sh`（父级和 child 两种场景 fixture）
- Create / Modify: `tests/integration/spec-mcp-setup/coverage-gap-*.sh`
- Create / Modify: `tests/integration/spec-mcp-setup/crlf-windows-path-*.sh`（CRLF + Windows 路径 fixture）
- Modify: `skills/spec-mcp-setup/SKILL.md`
- Modify: `docs/02-架构设计/`（v2 schema 描述）
- Modify: `docs/05-用户手册/`（broken-worktree 章节）

**Test scenarios:**
- Integration: broken-worktree fixture（父级）→ `git_health.status="broken-worktree"` + `worktree_pointer.exists=false` + next_action 含 repair-worktree
- Integration: broken-worktree fixture（child）→ 不进 `candidate_roots`，出现在 `candidates_diagnostics[]`
- Integration: corrupted-gitdir fixture → `git_health.status="corrupted-gitdir"` + next_action 含 `git fsck`
- Integration: coverage-gap fixture → `uncovered_top_level_dirs` 计数正确，sample 不含 child git roots
- Integration: CRLF + Windows 路径 fixture → `detect_git_health()` 正确解析
- Integration: ignore list 共享变量 → `discover_candidates` 和 `coverage_gap` 对 `build` 目录行为一致
- Integration: 现有 not-git workspace + single git repo 用例全通过

**Verification:**
- `npm run test:integration` P0 相关用例全绿
- SKILL.md 含 git_health / coverage_gap / candidates_diagnostics 词条

---

### U8. repair-worktree.sh

**Goal:** 新增 `skills/spec-mcp-setup/scripts/repair-worktree.sh`，实现 `--dry-run`（默认）+ `--apply` 两态；P1 只支持 `--unlink`；dry-run 输出含时间戳 advisory + unlink preview + 手动 git 修复建议文案两段；`--apply` 前重检 `.git` 状态，变化时拒绝并退出 `repair-worktree-state-changed`。

**Requirements:** R4

**Dependencies:** U1（`lib-git-health.sh` 在 U1 中提取，repair-worktree.sh source 该文件复用 `detect_git_health()`）

**Files:**
- Create: `skills/spec-mcp-setup/scripts/repair-worktree.sh`

**Approach:**
- 脚本顶部 `source "$SCRIPT_DIR/lib-git-health.sh"` 复用 `detect_git_health()`；不 source `resolve-project-target.sh`（该脚本有顶层参数解析循环和 `exit` 调用，source 会立即触发副作用）
- dry-run：调用 `detect_git_health`；确认 `broken-worktree` 后输出 ISO8601 时间戳 advisory + unlink preview（列出要删除的 `.git` 文件路径）+ 手动 git 修复建议文案（两段固定文案）
- `--apply`：重调 `detect_git_health`；status 非 `broken-worktree` 时输出 reason_code `repair-worktree-state-changed` + 提示重跑 dry-run，exit 1；status 仍为 `broken-worktree` 时执行 `rm .git`（整个 detect → unlink 在同一进程顺序执行）
- 非 broken-worktree 状态（健康 repo、corrupted-gitdir）下拒绝操作并说明原因
- 不引入外部锁文件

**Approach / detect → unlink 顺序：**
```
dry-run: detect_git_health() → print preview → exit 0
--apply: detect_git_health() → [status check] → detect_git_health() → [re-check] → rm .git → exit 0
```

**Test scenarios:**
- Happy path dry-run: broken-worktree fixture → preview 含 ISO8601 时间戳 advisory + unlink preview + 手动 git 修复建议两段
- Happy path apply: 删除 `.git` 文件后 `detect_git_health()` 返回 `not-git`
- Error path: 非 broken-worktree 状态（健康 repo）→ 拒绝操作，exit 1
- Error path: `--apply` 前 `.git` 被外部修改为健康 → `repair-worktree-state-changed`，exit 1

**Verification:**
- dry-run 输出包含时间戳 advisory、unlink preview、手动修复建议文案两段
- apply 后 `.git` 不存在，`detect_git_health()` 返回 `not-git`
- 健康 repo 和 corrupted-gitdir 均被拒绝

---

### U9. repair-worktree.ps1

**Goal:** 与 U8 同步实现 `.ps1` 版 `repair-worktree`，处理 Windows 文件删除和 CRLF。

**Requirements:** R4

**Dependencies:** U8（逻辑已明确）

**Files:**
- Create: `skills/spec-mcp-setup/scripts/repair-worktree.ps1`

**Verification:**
- .ps1 与 .sh 的 dry-run 输出结构一致
- Windows 文件删除（`Remove-Item`）正常工作

---

### U10. CLI 路由 — repair-worktree 子命令

**Goal:** 在 `src/cli/index.js` 新增 `repair-worktree` 分支，新增 `src/cli/commands/repair-worktree.js` 路由到对应 shell / ps1 脚本；`bin/spec-first.js` 无需改动（thin wrapper）。

**Requirements:** R4

**Dependencies:** U8, U9

**Files:**
- Modify: `src/cli/index.js`
- Create: `src/cli/commands/repair-worktree.js`

**Approach:**
- `src/cli/commands/` 目录无现有 shell 子进程 dispatch 模式（init.js 是纯 JS，无 bash/pwsh 调用）；本 unit 需新建 dispatch pattern
- 使用 `child_process.execFileSync` 或 `spawnSyncWithTimeout`（参考 `src/cli/external-command.js` 的 git 调用模式），按平台（macOS/Linux → `bash`，Windows → `pwsh`）分发到对应脚本
- 脚本路径通过 `REPO_ROOT + 'skills/spec-mcp-setup/scripts/repair-worktree.{sh,ps1}'` 解析
- 传递 `--dry-run` / `--apply` 参数到脚本
- 不改动 `bin/spec-first.js`（thin wrapper 不感知命令列表）
- 在 `repair-worktree.js` 和 U10 PR 中文档化此 pattern 作为未来 shell-dispatch 命令的参考

**Patterns to follow:**
- `src/cli/external-command.js` — shell 子进程调用方式（spawnSyncWithTimeout）
- `src/cli/index.js` — if-cascade 路由模式

**Test scenarios:**
- Happy path: `spec-first repair-worktree --dry-run` 在 broken-worktree workspace → 打印 preview 并 exit 0
- Happy path: `spec-first repair-worktree --apply` 在 broken-worktree workspace → 执行 unlink 并 exit 0
- Error path: `spec-first repair-worktree --apply` 在健康 repo → exit 1 + 拒绝文案

**Verification:**
- `npm run test:smoke` 含 `repair-worktree` 子命令可调用验证
- CLI help 包含 repair-worktree 条目

---

### U11. P1 tests + docs

**Goal:** repair-worktree 的 integration tests + 用户手册更新。

**Requirements:** R4

**Dependencies:** U8–U10

**Files:**
- Create: `tests/integration/spec-mcp-setup/repair-worktree-dry-run.sh`
- Create: `tests/integration/spec-mcp-setup/repair-worktree-apply.sh`
- Modify: `docs/05-用户手册/`（repair-worktree 使用文档）

**Test scenarios:**
- Integration: dry-run 输出文案结构（时间戳 advisory + unlink preview + 手动修复建议）
- Integration: apply 后 fixture workspace `.git` 不存在
- Integration: 非 broken-worktree fixture → dry-run 和 apply 都拒绝
- Integration: apply 并发修改模拟（先 dry-run，修改 `.git` 后 apply）→ reason_code `repair-worktree-state-changed`

**Verification:**
- `npm run test:integration` P1 用例全绿
- 用户手册含 repair-worktree 章节

---

### U12. GitNexus multi-target spike + 耗时实测（P2 前置）

**Goal:** 验证 `.gitnexus/meta.json` 在同一 workspace 下多 target 并存时的 label 唯一性行为（父 folder target + N child git repo 同时写入 canonical artifacts）；实测 `bootstrap-providers --folder <kaz-mvp>` 的端到端耗时。记录 spike 结论和耗时数据，作为 P2 plan 的 Key Technical Decisions 输入。

**Requirements:** R8（P2 前置）

**Dependencies:** U1–U11 done（P0 + P1 稳定后 spike）

**Files:**
- Create: `docs/plans/spike/2026-05-27-spike-gitnexus-multi-target-label.md`（spike 结论文档）

**Approach:**
- 在 kaz-mvp 工作区按当前 CLI 支持的形状做多次顺序调用：先对 1-2 个 child repo 分别运行 `bootstrap-providers.sh --repo <child>`，再运行 `bootstrap-providers.sh --folder .`；不得使用当前被 `bootstrap-providers.sh` 禁止的 `--folder . --repo <child>` 同次参数组合
- 观察 `.gitnexus/meta.json`、`.spec-first/graph/*`、`.spec-first/providers/*`、`.spec-first/impact/*` 在多 target 顺序写入后的 label / target identity 行为
- 记录：label 是否全局唯一、同一 workspace 多次调用是否互相覆盖、是否存在需要显式 label 参数的约束，以及现有 CLI 是否需要新增 `--label` 或等价参数
- 实测 `bootstrap-providers --folder .` 在 kaz-mvp（~30 个非 git 顶级目录）的端到端耗时
- 按耗时区间（≤5 分钟 / 5-15 分钟 / >15 分钟）决定 P2 的 advisory 策略

**Spike P2 闸门：**
- Spike 通过（label 唯一性满足）→ 进入 P2 开发
- Spike 失败（label 冲突或不支持多 target）→ R8 降级（见下方降级说明），P2 整体延迟

**Spike 失败时 R8 降级行为（需在 spike 文档中明确）：**
- `resolve-project-target` 仍 emit `additional_folder_targets` 字段（配置依然解析）
- `bootstrap-providers` 不追加 `--folder` 调用
- `parent_workspace_advisory` 增 `additional_folder_targets_status: spike-failed` + reason
- SKILL.md 引导用户手动分次调用 `bootstrap-providers --folder <path>`

**Spike 文档 `docs/plans/spike/2026-05-27-spike-gitnexus-multi-target-label.md` 最小 schema：**
- `label_uniqueness_conclusion: pass | fail | inconclusive`
- `evidence`: 具体 label 冲突场景或一致性证明
- `perf_measurement_seconds`: 端到端耗时（kaz-mvp 实测值）
- `p2_gate_decision: proceed | defer-r8`
- `u15_interface_proposal` (pass 时): computed_exclude 传递接口设计（参数形式）

**Verification:**
- spike 结论文档存在，含以上 5 个必填字段
- 基于 spike 结论更新本 plan 的 Key Technical Decisions（Spike pass/fail + 耗时区间 + U15 接口设计）

---

### U13. YAML config parser Node helper

**Goal:** 在 `src/cli/commands/internal.js` 新增 sub-action `parse-workspace-config <yaml-file>` → stdout JSON；供 `resolve-project-target.{sh,ps1}` 通过 `node bin/spec-first.js internal parse-workspace-config` 调用，输出 `workspace.additional_folder_targets[]` 的 JSON 表示。默认实现目标 YAML 子集解析器，不依赖 `yq` 或未声明的 transitive dependency。

**Requirements:** R6, R7

**Dependencies:** U12（spike 通过后 P2 正式开始）

**Files:**
- Modify: `src/cli/commands/internal.js`

**Approach:**
- Node 22 无原生 `node:yaml` 模块；`js-yaml` 未在 `package.json` 声明为生产依赖，不能依赖 dev/transitive 安装状态
- 默认实现明确定义的 YAML 子集解析器，不新增 dependency；若后续决定使用 `js-yaml`，必须先加入 direct production dependency 并验证 `npm pack --dry-run`
- 支持的 YAML 子集：`workspace.additional_folder_targets[]` 数组，每项含 `path`（字符串）、`label`（字符串）、`extra_exclude`（字符串数组，可选）；路径/label 值中允许空格和常见特殊字符
- 输出标准 JSON 到 stdout；解析失败时 exit 1 + stderr 说明
- 不处理 YAML anchors / complex types

**Test scenarios:**
- Happy path: 含 `workspace.additional_folder_targets` 段的 YAML → 正确 JSON
- Edge case: 无 `workspace` 段 → 输出 `{}`
- Error path: 无效 YAML → exit 1 + stderr

**Verification:**
- `node bin/spec-first.js internal parse-workspace-config <fixture.yaml>` 输出正确 JSON

---

### U14. workspace-mixed-topology mode — resolve-project-target.{sh,ps1}

**Goal:** `resolve-project-target.{sh,ps1}` 优先读 `.spec-first/config.local.yaml`，当存在 `workspace.additional_folder_targets[]` 且无 CLI 显式参数 + CWD_GIT_ROOT 为空时，输出 `mode="workspace-mixed-topology"` + `additional_folder_targets[]`（含 `computed_exclude`）；R6 路径校验（workspace_root 内、拒绝 `..` 上溯、符号链接逃逸检测）。

**Requirements:** R6, R7

**Dependencies:** U13, U12

**Files:**
- Modify: `skills/spec-mcp-setup/scripts/resolve-project-target.sh`
- Modify: `skills/spec-mcp-setup/scripts/resolve-project-target.ps1`
- Modify: `skills/spec-mcp-setup/scripts/write-provider-config.sh`（输出 `computed_exclude` 用于审计）
- Modify: `skills/spec-mcp-setup/scripts/write-provider-config.ps1`

**Approach:**
- 优先级判断按 R7：CLI --folder > CLI --repo > CWD_GIT_ROOT 非空 > workspace config > 现有 workspace 模式
- 调用 `node bin/spec-first.js internal parse-workspace-config .spec-first/config.local.yaml` 获取 JSON
- 对每个 `additional_folder_targets[]` 条目执行 R6 路径校验，失败时输出对应 reason_code
- 计算 `computed_exclude = discovered_child_git_roots ∪ IGNORE_LIST ∪ user_extra_exclude`
- `mode` 输出 `workspace-mixed-topology`

**Test scenarios:**
- Happy path: YAML 含 `path: "."` + `label: "parent"` → `mode="workspace-mixed-topology"` + `computed_exclude` 含所有 child git roots
- Edge case: `path: "../sibling"` → reason_code `additional-folder-target-uses-parent-ref`
- Edge case: `path: "/outside/workspace"` → reason_code `additional-folder-target-outside-workspace`
- Edge case: path 不存在 → reason_code `additional-folder-target-not-found`
- Edge case: 无 `workspace.additional_folder_targets` 配置 → 行为完全不变（现有 mode 保持）
- Edge case: CLI `--folder <path>` → 忽略 workspace 配置，mode=`non-git-folder`
- Edge case: CWD_GIT_ROOT 非空（修复 broken worktree 后）且 `config.local.yaml` 存在 `additional_folder_targets` → mode=`git-repo`（优先级 3），`parent_workspace_advisory` 输出 advisory 说明 `additional_folder_targets` 配置在 git-repo 模式下被忽略及原因

**Verification:**
- 无配置时行为与旧版 100% 一致（regression test）
- path 校验 reason_code 均可触发
- broken-worktree 修复后（CWD_GIT_ROOT 非空）的行为有明确 advisory 输出

---

### U15. bootstrap-providers all-repos + folder + resolve-workspace-graph-targets

**Goal:** `bootstrap-providers.{sh,ps1}` all-repos loop 在 child loop 之后追加 `--folder` 调用（传 computed_exclude）；`resolve-workspace-graph-targets.{sh,ps1}` mode 正向枚举显式加入 `workspace-mixed-topology`；parent advisory summary 增 `additional_folder_targets[]` 节点。

**Requirements:** R8

**Dependencies:** U14

**Files:**
- Modify: `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh` (L632-657)
- Modify: `skills/spec-graph-bootstrap/scripts/bootstrap-providers.ps1`
- Modify: `skills/spec-graph-bootstrap/scripts/resolve-workspace-graph-targets.sh` (L528)
- Modify: `skills/spec-graph-bootstrap/scripts/resolve-workspace-graph-targets.ps1` (L545)

**Approach:**
- 注意：bootstrap-providers.sh 当前不支持 `--label` 参数（L103-131 只有 --repo / --folder / --all-repos / --incremental / --full / --force）；computed_exclude 传递形式亦未定义。**U15 开发前须先完成 U12 spike，spike 文档须包含 `u15_interface_proposal` 字段（computed_exclude 传递接口设计）。**
- 在 child loop 结束后读取 `additional_folder_targets[]`，按 spike 文档确定的接口形式追加 `--folder` 调用（传入 label + computed_exclude）
- 若 `CANDIDATE_COUNT=0`（无 child git repo）但 `TARGET_MODE=workspace-mixed-topology` 且 `additional_folder_targets` 非空，则在 L593 的 zero-candidate gate 处加 bypass，允许继续进入 folder loop
- `resolve-workspace-graph-targets.sh:528` 的 mode 正向枚举加入 `workspace-mixed-topology`，使其与 `workspace-multi-repo` 走同一处理路径（或单独分支）
- parent advisory summary `.spec-first/workspace/graph-bootstrap-summary.json` 增 `additional_folder_targets[]` 节点，记录每个 folder target 的写入状态

**Test scenarios:**
- Integration: mixed-topology fixture → child loop 后追加 1 次 --folder 调用 → 7 套 canonical artifacts（6 child + 1 folder）
- Integration: `computed_exclude` 自动包含 6 child git roots（不需要用户手动列出）
- Integration: `resolve-workspace-graph-targets` 对 `workspace-mixed-topology` mode 不静默跳过
- Edge case: 无 `additional_folder_targets` 配置 → all-repos loop 行为不变

**Verification:**
- 7 套 canonical artifacts 写入正确路径
- `resolve-workspace-graph-targets` 处理 `workspace-mixed-topology` 无 fallback

---

### U16. P2 tests + config-template + docs

**Goal:** P2 所有新行为的 contract / integration 测试；`skills/spec-mcp-setup/references/config-template.yaml` 增 `workspace.additional_folder_targets[]` 示例段；`docs/contracts/graph-provider-consumption.md` 加 mixed-topology 段；用户手册和架构文档同步。

**Requirements:** R6, R7, R8

**Dependencies:** U13–U15

**Files:**
- Modify: `skills/spec-mcp-setup/references/config-template.yaml`（增 workspace 示例段 + 注释）
- Create / Modify: `tests/integration/spec-graph-bootstrap/mixed-topology-*.sh`
- Modify: `docs/contracts/graph-provider-consumption.md`（mixed-topology 段 + repo label 不冲突约束）
- Modify: `docs/02-架构设计/`（workspace-mixed-topology mode）
- Modify: `docs/05-用户手册/`（additional_folder_targets 配置说明）

**Test scenarios:**
- Integration: mixed-topology fixture → child + folder 双轨写入、auto-exclude 合并、advisory summary
- Integration: `extra_exclude` 缺失时 computed_exclude 仍自动包含 child git roots
- Integration: `path` 校验 reason_code 各路径（outside-workspace / parent-ref / not-found / not-directory / symlink-escape）
- Integration: 无配置时行为等同旧版

**Verification:**
- `npm run test:integration` P2 用例全绿
- config-template.yaml 含 workspace.additional_folder_targets 注释示例
- docs/contracts/graph-provider-consumption.md 含 mixed-topology 和 label 唯一性说明

---

## System-Wide Impact

- **Interaction graph:** `resolve-project-target` → `detect-tools` → `verify-tools` 链路全部受 P0 影响；`check-health` 保持独立 preflight，不承载 `git_health` 字段传递；`bootstrap-providers` → `resolve-workspace-graph-targets` 在 P2 受影响；新 `repair-worktree` 命令是独立链路，不被任何现有命令自动调用。
- **Error propagation:** `detect_git_health()` 产出的 reason_code 通过 JSON 字段从 `resolve-project-target` 冒泡到 `detect-tools`，再由 `verify-tools` 写入 readiness ledger；`repair-worktree` 的 reason_code 直接 exit 1 + stderr。
- **State lifecycle risks:** P0 只读；P1 的 `repair-worktree --apply` 是显式 opt-in 写操作，会删除 broken `.git` 文件且不可逆。dry-run 默认 + apply 前二次重检设计缓解并发修改风险。
- **API surface parity:** `project-target.v2` 是 v1 的超集，不破坏 write-provider-config / verify-tools / bootstrap-providers 的现有字段读取；新增字段只在消费者按字段存在与否处理时安全。
- **Integration coverage:** broken-worktree fixture 需要能在 CI 中构造（无需真实 git worktree）；P2 mixed-topology fixture 需要能模拟 additional_folder_targets 路径检查，无需真实 30 个目录。
- **Unchanged invariants:** `baseline_ready` 语义不变；`git-repo / non-git-folder` mode 的现有行为不变；`discover_candidates` 的现有 candidate 过滤逻辑不变（仅添加诊断，不改变输出的 candidate_roots）；`bootstrap-providers` 现有 child loop 不变（P2 在其之后追加）。

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| schema v2 有未发现的消费者做字面值比较 | P0 开发前在 `skills/`、`src/`、`tests/` 下 grep `project-target.v1` 审计执行影响面；U5 前置 grep 步骤强制执行，历史 docs 引用不计入残留 |
| GitNexus multi-target label 冲突（P2 闸门） | U12 spike 是 P2 硬前置；spike 失败则 R8 降级为文档引导，P2 延迟 |
| 父级 folder target 索引耗时 >15 分钟（P2 延迟触发） | U12 实测结果决定 advisory 策略；>15 分钟触发二次设计讨论，不强制 commit background mode |
| `--apply` 并发修改导致误删健康 repo `.git` | U8 重检设计：apply 前二次 `detect_git_health()`；状态变化时 reason_code `repair-worktree-state-changed` + 拒绝 |
| YAML 解析失败导致 resolve-project-target 静默降级 | Node helper exit 1 + stderr；shell 脚本捕获 exit code，降级为"无 workspace 配置"行为，不 crash |
| `build` 加入忽略列表误过滤非 build 产物目录 | 加 `build` 到共享 `IGNORE_DIR_PATTERN` 同时影响 `discover_candidates` 候选发现和 `coverage_gap` 计数（两者共享同一变量）；`build` 通常不含独立 git repo，若有则通过 explicit `--repo` 指定。`--folder` 显式调用范围不受影响。 |
| `.ps1` CRLF / Windows 路径解析与 `.sh` 行为分叉 | U2/U4/U9 明确 CRLF 规范化 + 反斜杠处理；fixture 测试覆盖 Windows 路径场景 |

---

## Phased Delivery

### Phase P0（诊断诚实性）

**目标：** 用户运行 `/spec:mcp-setup` 时，setup 报告中能看到 broken worktree 状态、coverage gap 计数、扩展的 next_action 文案。`baseline_ready` 语义不变。

**单元：** U1 → U2 → U3 → U4 → U5 → U6 → U7（P0 tests + docs）

**Definition of done：** 在 broken-worktree + coverage-gap fixture 下，setup 报告含 `git_health.status="broken-worktree"` + `worktree_pointer.exists=false` + `coverage_gap.uncovered_top_level_dirs` + next_action repair-worktree 文案；`discover_candidates` 和 `coverage_gap` 的忽略列表来自同一变量（含 `build`）；`skills/`、`src/`、`tests/` 中无旧 `project-target.v1` emit / 字面值消费者残留。

---

### Phase P1（修复脚本）

**目标：** `spec-first repair-worktree` 子命令可用，提供 preview-first unlink 修复路径。

**单元：** U8 → U9 → U10 → U11（P1 tests + docs）

**Definition of done：** `spec-first repair-worktree --dry-run` 在 broken-worktree fixture 下输出时间戳 advisory + unlink preview + 手动 git 修复建议文案；`--apply` 只执行 unlink；apply 前并发修改重检生效；健康 repo 被拒绝。

---

### Phase Spike（P2 前置，强依赖）

**目标：** 验证 GitNexus multi-target label 行为 + 父级 folder 索引耗时，产出 P2 开发决策依据。

**单元：** U12

**Gate：** spike 文档存在 + 结论明确（pass / fail + 耗时区间）。Pass → 进入 P2；Fail → R8 降级为文档引导，P2 整体延迟。

---

### Phase P2（配置驱动拓扑，依赖 Spike Pass）

**目标：** 用户在 `.spec-first/config.local.yaml` 写 `workspace.additional_folder_targets`，`/spec:graph-bootstrap` 自动覆盖 N child git repo + M parent folder target；`resolve-workspace-graph-targets` 正确处理新 mode。

**单元：** U13 → U14 → U15 → U16（P2 tests + config-template + docs）

**Definition of done：** mixed-topology fixture 下 `bootstrap-providers --all-repos` 写入 child + folder 双轨 canonical artifacts；`computed_exclude` 自动包含所有 child git roots；无 `additional_folder_targets` 配置时行为完全等同旧版；`resolve-workspace-graph-targets` 不静默跳过 `workspace-mixed-topology` mode。

---

## Documentation Plan

- `CHANGELOG.md`：P0/P1/P2 各阶段落地时追加 changelog 条目（user-visible），记录 schema v2 bump、新 mode、新子命令、配置扩展。
- `skills/spec-mcp-setup/SKILL.md`：P0 完成后补 git_health / coverage_gap / candidates_diagnostics / next_action 分支语义说明；P1 完成后补 repair-worktree 使用说明；P2 完成后补 additional_folder_targets 配置说明。
- `docs/02-架构设计/`：P0 schema v2 字段描述；P2 workspace-mixed-topology mode 架构说明。
- `docs/05-用户手册/`：P0 broken-worktree 诊断章节；P1 repair-worktree 使用文档；P2 additional_folder_targets 配置说明。
- `docs/contracts/graph-provider-consumption.md`：P2 补 mixed-topology 段 + repo label 唯一性约束。
- `skills/spec-mcp-setup/references/config-template.yaml`：P2 增 `workspace.additional_folder_targets[]` 示例段 + 注释（无 parent_role 枚举）。

---

## Operational / Rollout Notes

- **无 breaking change：** P0 schema v2 是 v1 超集；P1 是新增子命令；P2 配置完全可选。现有用户不配置 `workspace.additional_folder_targets` 时，行为完全不变。
- **P0 deploy 后验证：** 在 kaz-mvp 工作区跑一次 `/spec:mcp-setup`，确认 setup 报告含 git_health + coverage_gap 字段。
- **P1 deploy 后验证：** `spec-first repair-worktree --dry-run` 在 kaz-mvp 输出正确 preview 文案；`--apply` 拒绝在健康 repo 上执行。
- **Spike 结论必须记录到 plan：** U12 完成后将 label 行为结论和耗时数据写入本 plan 的 Key Technical Decisions，作为 P2 审计依据。
- **P2 deploy 后验证：** 在 kaz-mvp 配置 `workspace.additional_folder_targets[{path:".", label:"kaz-mvp-parent"}]`，跑 `/spec:graph-bootstrap`，确认 7 套 canonical artifacts（6 child + 1 folder）写入成功。
- **source-only 原则：** 所有改动只改 source（`skills/`, `src/cli/`, `docs/`），不手改 generated runtime mirror（`.claude/`, `.codex/`, `.agents/skills/`）；改动落地后如需刷新 runtime，运行 `spec-first init`。

---

## Sources & References

- **Origin document:** [`docs/brainstorms/2026-05-27-002-mixed-topology-broken-worktree-optimization-proposal.md`](../brainstorms/2026-05-27-002-mixed-topology-broken-worktree-optimization-proposal.md)
- Related code: `skills/spec-mcp-setup/scripts/resolve-project-target.sh:114` (broken worktree 静默点)
- Related code: `skills/spec-mcp-setup/scripts/resolve-project-target.sh:148-191` (`discover_candidates` + 忽略列表)
- Related code: `skills/spec-mcp-setup/scripts/verify-tools.sh:360-407` (readiness ledger v2 emit)
- Related code: `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh:632-657` (all-repos child loop)
- Related code: `skills/spec-graph-bootstrap/scripts/resolve-workspace-graph-targets.sh:528` (mode 正向枚举)
- Related plans: `docs/plans/2026-04-28-005-feat-workspace-target-readiness-plan.md` (workspace target 已有结构)
- Related plans: `docs/plans/2026-04-26-003-feat-crg-workspace-topology-plan.md` (早期 workspace 拓扑探索)
- Related brainstorm: `docs/brainstorms/2026-05-25-001-gitnexus-only-graph-provider-requirements.md` (`analyze --skip-git` non-git 索引能力)
