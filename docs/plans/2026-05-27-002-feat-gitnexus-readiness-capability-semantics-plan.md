---
date: 2026-05-27
spec_id: 2026-05-27-001-gitnexus-readiness-capability-semantics
status: active
type: feat
origin: docs/brainstorms/2026-05-27-001-gitnexus-readiness-capability-semantics-requirements.md
deepened: 2026-05-27
---

# feat: GitNexus readiness capability semantics surfacing & lock-in

## Summary

把 origin 需求文档里大部分已经在代码层落地的 capability semantics 固化为可见 prose 与 anti-regression 测试，并补上唯一缺的 surfacing 缺口：让 `bootstrap-report.md` 的人类 prose 与机读 `bootstrap-impact-capabilities.json` 同步暴露 query/context · impact · review 三维度状态。集中 capability vocabulary 到一处 source-of-truth（扩展现有 `gitnexus-capability-catalog.md`），让 README、skill prose、startup snapshot、contract 全部引用同一处定义，避免 query_ready=true 又被理解为"all GitNexus capabilities active"。

不新增 schema 字段，不修改 GitNexus provider 内部，不引入新的 readiness 真相源。Plan v2 已根据 doc-review 三 reviewer findings（coherence/feasibility/scope）整合：合并测试加固为单 unit、修正 sh/ps1 实际变量名引用、修正 helper 输入模型与 fixture 形态、修正 R15f 测试归属。

---

## Problem Frame

Origin 文档 R1-R15 与本仓库现状比对显示：R2/R3/R4/R5/R6/R8/R9/R10/R12/R13 已在代码、contract、prose 中落地。R7、R11、R14、R15 是真实工作面：

- R7 缺口：`bootstrap-impact-capabilities.json` 已含 `context_selection · impact_radius · review_support` 三维度机读 matrix（jq 派生于 `bootstrap-providers.sh:3164-3189`，对应 ps1:3449-3471 PSCustomObject），`bootstrap-report.md` 模板（sh:3206-3225 与 ps1:3499-3518）只渲染 provider 单行表 + verification reason。三维度状态被埋在另一个 JSON 里。
- R11 部分：`src/cli/helpers/review-pre-facts.js:680-712, 769-793, 909-918` 已用从 `provider.normalized_artifacts.{architecture_facts, impact_capabilities}` 指向的 normalized JSON 派生 `available_query_surfaces[]` 来门控 `availableOperations`。缺 fixture 锁定"normalized artifact `available_query_surfaces=["query","context"]` 时 query_plan 不发出 impact/detect_changes"。
- R14 部分：各 skill prose、contract 内部 vocabulary 一致，但散落在 7+ 处，没有任何文件作为 vocabulary 的 source-of-truth；README/CHANGELOG 也未与之 cross-reference。
- R15 缺口：6 条最小 user-visible test surface（R15a-R15f）只部分落地（`tests/unit/version-reminder.sh:627`、`tests/unit/spec-graph-bootstrap-contracts.test.js:99-109`），其余 4 条无固定测试。

本工作不新增 GitNexus 调用、不动 provider、不重做已落地 contract；只补 R7 的 surfacing、把 vocabulary 集中到一处、加最小 anti-regression 测试。

---

## Goals

- 让 `bootstrap-report.md` 的人类 prose 与 `bootstrap-impact-capabilities.json` 的机读 matrix 同时显示 query/context · impact · review 三维度状态（R7）。
- 把 GitNexus capability state 词汇集中固化到 `docs/contracts/gitnexus-capability-catalog.md`（位于 Verification Posture 章节后），其他 surface（README、skill prose、startup snapshot 注释）引用此处（R1, R14）。
- 把 R11 从 partial 升级到 locked-in：`review-pre-facts-helper.test.js` 加 fixture 锁定 normalized-artifact 输入下 query_plan 不发出 impact/detect_changes（R15d）。
- 在 `tests/unit/` 既有 suite + 新建 1 个 isolation-contracts suite 中补齐 R15a-R15f 共 6 条最小 anti-regression 测试。

## Non-Goals

- 不修改 GitNexus provider 内部、不让 definitions-only 升级为 process graph evidence。
- 不新增机读 schema 字段：`bootstrap-impact-capabilities.json` 既有结构已足够，本工作只补人类 prose 渲染。
- 不让 `spec-mcp-setup` 跑 GitNexus analyze/build/index/group sync/refresh。
- 不把 `route_map`、`api_impact`、`shape_check`、`tool_map`、`cypher`、group resources、`group_sync`、`rename` 推到 deterministic pre-facts query-plan。
- 不让 review autofix、mutation、live MCP probe 写入 canonical readiness 路径。
- 不手改 `.claude/`、`.codex/`、`.agents/skills/` 等 generated runtime mirror（CLAUDE.md 强制基线）。
- 不修改 `docs/contracts/workflows/review-pre-facts-extraction.md`（contract 已声明 helper scope 排除项；本工作只补 fixture 验证）。
- 不修改 `docs/contracts/graph-evidence-policy.md` / `downstream-graph-evidence-consumption.md`（已含 non-expansion rule 与 definitions-only source-read 规则）。
- 不新增统一 `getCapabilityMatrix()` accessor 等抽象（直接 grep 模板字面量即可）。

---

## Graph Readiness

- target_repo: spec-first（当前仓库本身）
- status: degraded-fallback
- source_revision: 5a23afb035d8da295f828190e56cbd9b5ad39dfa（与 `.spec-first/graph/graph-facts.json` 一致）
- current_revision: 5a23afb035d8da295f828190e56cbd9b5ad39dfa（HEAD）
- stale: true（startup snapshot 报 `freshness=stale`；当前 worktree dirty）
- primary_providers: gitnexus（query_ready=true 但 definitions-only）
- degraded_providers: gitnexus（impact/review/process graph unavailable）
- fallback_capabilities: bounded direct repo reads（已用：bootstrap-providers.sh、bootstrap-providers.ps1、review-pre-facts.js、tests/unit/* 直接 grep/Read 验证 reviewer findings）
- runtime_mcp_evidence: not-attempted（任务范围内不需要 live MCP 调用）
- confidence: high（feasibility reviewer 已验证全部 file_path:line_number；3 条 confidence-100 修订已整合）
- limitations: definitions-only no process graph、definitions-only no impact evidence、definitions-only no related tests

## Graph / GitNexus Evidence

- evidence_posture: fallback
- evidence_grade: primary（直接 source 验证）
- provider: not-applicable（plan 不需要 live GitNexus 评估）
- capability_status: n/a
- capabilities_used: bounded direct repo reads
- key_findings: bootstrap-providers.sh:3140-3196 直接管道 jq→write_file_atomic，未保存中间变量；ps1:3444-3478 用 `$impactCapabilities` ordered hashtable；review-pre-facts.js helper 通过 `repoRoot` 自动读 `.spec-first/`，availableOperations 派生自 normalized artifact 自己的 `available_query_surfaces[]`
- source_reads_required: skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh、bootstrap-providers.ps1、docs/contracts/gitnexus-capability-catalog.md、tests/unit/spec-graph-bootstrap-contracts.test.js、tests/unit/review-pre-facts-helper.test.js、tests/unit/version-reminder.sh、tests/unit/no-graph-fast-path-contracts.test.js、src/cli/helpers/review-pre-facts.js、src/cli/version-reminder.js
- source_tags: [checked-in-baseline]
- limitations: 无 live MCP（不需要）

---

## Context & Research

### Origin Document Carry-Forward

- spec_id 继承自 origin。
- Actors A1-A5 作为本 plan 的 stakeholder 类别保留。
- Key Flows F1-F4 分别对应：F1（setup handoff）→ R5（已 locked-in），R15e；F2（bootstrap capability classification）→ R7、R8、R15b；F3（startup snapshot）→ R13、R15c；F4（downstream pre-facts gating）→ R11、R15d。
- Acceptance Examples AE1-AE6 全部继承为本 plan verification 的 ground truth。各 AE 的覆盖映射见 "AE Coverage Map" 章节，避免 unit 间重复 Covers。
- Origin Outstanding Questions 已在 Key Technical Decisions 中 settle。

### AE Coverage Map

| AE | 覆盖的 R | 实现 unit | 验证 unit | 备注 |
|---|---|---|---|---|
| AE1 | R1, R4, R5 | 已 locked-in（既有 spec-mcp-setup SKILL.md）+ U1（vocabulary） | U4（R15e prose 断言） | R1/R4/R5 prose 已在代码层落地；U1 集中术语；U4 仅加测试验证 |
| AE2 | R2, R7, R8 | U2（prose 实现） | U4（R15a/R15b anti-regression） | U2 完成 prose；U4 锁定不被回退 |
| AE3 | R7, R9 | U2 | U4（R15b dirty-advisory 断言） | dirty-advisory 已 locked-in；U2 在 dirty 路径也加 matrix |
| AE4 | R10, R13 | 已 locked-in（gitnexus-capability-catalog.md + version-reminder.js）+ U1 | U4（R15c/R15f） | live MCP session-local 措辞已固化；U4 加测试验证 |
| AE5 | R11, R12 | U3（fixture）+ 已 locked-in（downstream-graph-evidence-consumption.md） | U4（R15d query_plan 断言） | U3 提供 fixture；U4 用 fixture 锁定门控行为 |
| AE6 | R14, R15 | U1+U5（vocabulary 集中 + README 对齐） | U4（vocabulary cross-ref 断言） | 全 plan 收尾验证 |

### Repo Patterns to Follow

- Skill 内 shell + powershell 双宿主对称：`bootstrap-providers.sh`（3281 行）与 `.ps1`（3551 行）对称；本工作的 prose 渲染必须双宿主同步，但 sh 端必须先把 `jq -n` 输出 capture 到 shell 变量后再 pipe 到 `write_file_atomic`，否则后续无法派生 matrix prose（feasibility reviewer 已确认现状是直接管道）。
- Capability 词汇散落在：`docs/contracts/gitnexus-capability-catalog.md`（已含 `Source Tag Vocabulary`，`session-local-inference`、`live-mcp-tool`、`live-mcp-resource`、`setup-projection` 等部分词汇已在；新增章节须避免与之同义词漂移）、`docs/contracts/graph-provider-consumption.md`、`docs/contracts/downstream-graph-evidence-consumption.md`、`docs/contracts/graph-evidence-policy.md`、`skills/spec-graph-bootstrap/SKILL.md`、`skills/spec-mcp-setup/SKILL.md`、`src/cli/version-reminder.js`、`README.md`、`README.zh-CN.md`。
- Test fixture 注入约定：`tests/unit/review-pre-facts-helper.test.js:73-137` 用 `writeGraphArtifacts(repo)` pattern——在 tmp git repo 写完整 `.spec-first/...` 目录树，而非把多个 fixture 文件路径作为 helper arg；feasibility reviewer 已确认 helper `computeReadiness(repoRoot)` 自动从 repoRoot 读固定路径。
- Hash before/after pattern：参考 `tests/unit/multi-actor-worktree-governance-contracts.test.js:63-69` 与 `tests/unit/spec-app-consistency-audit-preflight.test.js:234`，使用 `crypto.createHash('sha256')`。
- jq 派生字段写入 prose 模板时使用 `<<MD ... MD` heredoc，新增字段必须先用 `jq -r` 派生为 shell 变量再插入。

### Institutional Learnings

- `docs/plans/2026-05-25-001-gitnexus-only-graph-provider-plan.md` 已确立 GitNexus 单 provider 边界。
- `docs/plans/2026-05-27-001-feat-gitnexus-bounded-pre-facts-plan.md`（同日 plan #001）刚把 review-pre-facts deterministic helper 引入；本工作 U3 锁定其 gating 不变量。
- `docs/contracts/workflows/review-pre-facts-extraction.md:93` 已声明 helper scope 的排除项；本 plan 不重写这条 contract。

### External Research

不需要。所有变更点都是 spec-first 仓库内的 prose、contract、测试与 shell 脚本，无外部 framework 依赖变化。

---

## Key Technical Decisions

| Question | Recommended Answer | Source Tag | Chosen Answer | Consequence |
|---|---|---|---|---|
| Vocabulary 集中应新建独立文件还是扩展现有 catalog? | 扩展 `docs/contracts/gitnexus-capability-catalog.md`，在 "Verification Posture" 章节后插入"Capability State Vocabulary"小节；与既有 "Source Tag Vocabulary" 保持区隔（前者是 `source_tags[]` 闭合机读 enum，后者是 readiness lifecycle 状态词）。同义词对（如 `session-local` vs `session-local-inference`、`setup-inferred` vs `setup-projection`）在新章节首段显式说明区别。 | confirmed | 扩展现有 catalog | 单一 capability source-of-truth；其他 surface 用 cross-ref；不制造同义词对 |
| `review-pre-facts.js` 是否在 helper 层显式 fail-loud? | 保持隐式 + fixture 测试 | confirmed | 隐式 + fixture | helper 通过 normalized artifact `available_query_surfaces[]` 派生 `availableOperations` 是正确的隐式 gating；fixture 锁定不变量即可 |
| R15a-R15f 测试归属:聚合 suite 还是分散? | 大部分分散到既有 suite，R15f 新建独立 isolation-contracts test | confirmed | 分散 + R15f 新建 | 测试就近原则；R15f 的 hash before/after pattern 与既有 `no-graph-fast-path-contracts.test.js` 的 doc-string-include pattern 不兼容，单独立 contract test |
| bootstrap-report.md capability matrix 字段是否新增 schema? | 不新增；从既有 `bootstrap-impact-capabilities.json` 派生 | confirmed | 派生 | origin Key Decisions 已 settle |
| blocked 路径（`bootstrap-providers.sh:1259-1270`）是否也加 matrix? | 不加 | advisory | 不加 | graph 不就绪时 `bootstrap-impact-capabilities.json` 不存在或无有效数据；保留 `reason_code` + `next_action` 即可。U2 实现中应在 `bootstrap-impact-capabilities.json` 缺失或所有维度 support_level 为空时跳过 matrix 段落。 |
| sh 端如何引用 jq 派生的 impact-capabilities 数据? | 把 `jq -n ...` 输出先 capture 到 `impact_capabilities_json` shell 变量，再 `printf %s "$impact_capabilities_json" \| write_file_atomic ...`；PRESERVE_CANONICAL_FRESHNESS=true 路径用 `cat` 回读 | confirmed | capture+pipe | feasibility reviewer 确认 sh 端当前直接管道，没有可复用的中间变量 |

---

## High-Level Technical Design

> 以下为方向性指引，非实现规范。实现 agent 应把它当作 reviewer 验证方向用的草图。

### `bootstrap-report.md` Capability Matrix 渲染（R7）

`bootstrap-providers.sh:3140-3196` 现状：

```bash
if [ "$PRESERVE_CANONICAL_FRESHNESS" != "true" ] || [ ! -f "$IMPACT_DIR/bootstrap-impact-capabilities.json" ]; then
  jq -n ... | write_file_atomic "$IMPACT_DIR/bootstrap-impact-capabilities.json"
fi
# 之后 line 3199 直接拼 provider_report_rows，没有保存 impact JSON 到 shell 变量
```

目标形态（U2 落地后）：

```bash
if [ ... fresh ... ]; then
  impact_capabilities_json="$(jq -n ...)"
  printf '%s' "$impact_capabilities_json" | write_file_atomic "$IMPACT_DIR/bootstrap-impact-capabilities.json"
elif [ -f "$IMPACT_DIR/bootstrap-impact-capabilities.json" ]; then
  impact_capabilities_json="$(cat "$IMPACT_DIR/bootstrap-impact-capabilities.json")"
else
  impact_capabilities_json=""
fi

if [ -n "$impact_capabilities_json" ]; then
  capability_matrix_rows="$(jq -r '
    .capabilities |
    [
      "| query/context  | \(.context_selection.support_level) | \(.context_selection.confidence) | \((.context_selection.limitations // []) | first // "n/a") |",
      "| impact_radius  | \(.impact_radius.support_level) | \(.impact_radius.confidence) | \((.impact_radius.limitations // []) | first // "n/a") |",
      "| review_support | \(.review_support.support_level) | \(.review_support.confidence) | \((.review_support.limitations // []) | first // "n/a") |"
    ] | join("\n")
  ' <<<"$impact_capabilities_json")"
fi

# 模板：
# ## Capability Matrix
# | Capability | Support Level | Confidence | Note |
# | --- | --- | --- | --- |
# $capability_matrix_rows
```

ps1 端从已有的 `$impactCapabilities` ordered hashtable（line 3444）的 `.capabilities.context_selection / impact_radius / review_support` 直接派生 `$capabilityMatrixRows`，写入 line 3499 的 `Write-TextFileAtomic` 模板的尾部。无需新增中间变量。

Note 列截取 `limitations[0]`；空数组时填 `n/a`。`bootstrap-impact-capabilities.json` 缺失或所有 support_level 都是空字符串时跳过 matrix 段落。

### Capability State Vocabulary 章节

在 `gitnexus-capability-catalog.md` 的 "Verification Posture"（line 43-47）章节后插入：

```text
## Capability State Vocabulary

> 区别于上文 "Source Tag Vocabulary"（machine-readable 闭合 `source_tags[]` enum）：
> 本节是 readiness lifecycle 状态词的 prose 词典，供 README、skill prose、
> bootstrap-report、startup snapshot、plan/work/review/debug workflow 引用。

| 术语 | 含义 | 出现位置（典型）| 与 source_tags 关系 |
| --- | --- | --- | --- |
| host_config_written | spec-mcp-setup 已写入 host MCP 配置文件 | mcp-setup 输出 | 与 setup-projection 同一阶段，但本身是 prose 状态 |
| current_session_loaded | 当前 host session 已加载 GitNexus MCP tool | startup snapshot, runtime probe | 对应 live-mcp-tool / live-mcp-resource source_tags |
| graph_compiled | bootstrap 已编译 canonical graph readiness | graph-facts.json, bootstrap-report.md | 不是 source_tag，是 canonical artifact 状态 |
| query_ready | provider 可响应 GitNexus query/context 调用 | provider-status.json | 不是 source_tag |
| definitions-only | query 只支持 file/symbol orientation, 不证明 process graph | provider-status.result_class, bootstrap-report prose | 不是 source_tag |
| dirty-advisory | bootstrap 在 dirty worktree 下完成，readiness 仅作 advisory | graph-facts.freshness_state | 不是 source_tag |
| graph-affecting-blocked | dirty 路径中含 graph-relevant 文件 | graph-facts.dirty_classification | 不是 source_tag |
| stale | source_revision/worktree_status_hash 与 graph-facts 记录不符 | startup snapshot, plan/work readiness check | 不是 source_tag |
| session-local | 来源于当前会话，不写入 canonical readiness | review/plan evidence handling | session-local-inference 是 LLM 推断版本；session-local 是 raw 调用结果版本 |
| setup-inferred | 来自 spec-mcp-setup 的 availability/discovery, 不是 query-ready 证据 | runtime-capabilities.json | setup-projection 是 source_tag；setup-inferred 是 prose 等价描述 |

> 其他 contract / skill prose / README / startup snapshot 必须使用上述术语；新增同义词需先扩展本表。
```

### `review-pre-facts.js` 隐式 gating fixture

不改代码，只新增 fixture（按 helper 实际输入模型）：

```text
tests/fixtures/review-pre-facts/
  provider-status.definitions-only.json
    └── providers[0].normalized_artifacts.architecture_facts → "providers/gitnexus/normalized/architecture-facts.json"
    └── providers[0].normalized_artifacts.impact_capabilities → "providers/gitnexus/normalized/impact-capabilities.json"
  graph-facts.definitions-only.json
    └── source_revision / worktree_status_hash 字段（用于 snapshot match 路径）
  providers/gitnexus/normalized/
    architecture-facts.definitions-only.json
      └── available_query_surfaces: ["query","context"]
    impact-capabilities.definitions-only.json
      └── available_query_surfaces: ["query","context"]   ← 不含 "impact","detect_changes"
```

测试模式：`writeGraphArtifacts(tmpRepo, fixture)` 把 fixture 内容拷贝到 tmp git repo 的对应 `.spec-first/...` 路径，再调用 `runReviewPreFacts({ repoRoot: tmpRepo, mode: 'prepare' })`，断言返回 `query_plan.operations[]` 不含 `impact`、`detect_changes`。

---

## Output Structure

```text
docs/contracts/gitnexus-capability-catalog.md            # 扩展 (U1)
skills/spec-graph-bootstrap/scripts/
  bootstrap-providers.sh                                  # 修改 line 3140-3196 + 3199-3225 (U2)
  bootstrap-providers.ps1                                 # 修改 line 3499-3518 (U2)
tests/fixtures/review-pre-facts/
  provider-status.definitions-only.json                   # 新增 (U3)
  graph-facts.definitions-only.json                       # 新增 (U3)
  providers/gitnexus/normalized/
    architecture-facts.definitions-only.json              # 新增 (U3)
    impact-capabilities.definitions-only.json             # 新增 (U3)
tests/unit/
  spec-graph-bootstrap-contracts.test.js                  # 扩展 R15a/R15b (U4)
  review-pre-facts-helper.test.js                         # 扩展 R15d (U4)
  version-reminder.sh                                     # 扩展 R15c (U4)
  mcp-setup.sh                                            # 扩展 R15e (U4)
  live-mcp-canonical-isolation-contracts.test.js          # 新增 R15f (U4)
  gitnexus-capability-catalog-contracts.test.js           # 扩展 vocabulary 断言 (U1 关联)
  runtime-capability-catalog.test.js                      # 扩展 README cross-ref 断言 (U5)
README.md                                                 # 修改 (U5)
README.zh-CN.md                                           # 修改 (U5)
CHANGELOG.md                                              # 追加 (U5)
docs/brainstorms/2026-05-27-001-...-requirements.md       # 已修订完，本 plan 不再动
```

---

## Implementation Units

### U1. Capability State Vocabulary 集中固化

**Goal**: 在 `docs/contracts/gitnexus-capability-catalog.md` 的 "Verification Posture" 章节后插入 "Capability State Vocabulary" 小节，作为 R1 列出的所有 readiness lifecycle 状态词的 source-of-truth；并在 vocabulary 首段显式说明与既有 "Source Tag Vocabulary"（闭合 `source_tags[]` enum）的区别。

**Requirements**: R1 [partial→locked-in]（vocabulary 集中），关联 origin AE6 的 catalog 部分；R14 由 U5 的 README 对齐共同收尾。

**Dependencies**: 无。

**Files**:
- `docs/contracts/gitnexus-capability-catalog.md`（修改）
- `tests/unit/gitnexus-capability-catalog-contracts.test.js`（修改）

**Approach**:
- 找到 catalog "Verification Posture"（line 43-47）章节末，插入新章节 "## Capability State Vocabulary"，按照 High-Level Technical Design 中给出的术语表与首段说明。
- 表格列：术语 / 含义 / 典型出现位置 / 与 source_tags 关系。最后一列必须显式标记同义词对（`session-local` vs `session-local-inference`、`setup-inferred` vs `setup-projection` 等），避免读者混淆。
- 末尾给一行 cross-ref 提示："其他 contract / skill prose / README / startup snapshot 必须使用上述术语；新增同义词需先扩展本表。"
- 不引入新机读 schema，纯 prose contract。

**Patterns to follow**:
- 既有的 "Source Tag Vocabulary"（line 27-41）用闭合表格 + meaning + lifecycle 风格。
- "Lane Classification" 表格的列宽与对齐风格。

**Test scenarios** (in `tests/unit/gitnexus-capability-catalog-contracts.test.js`):
- 断言 catalog 包含字符串 `"Capability State Vocabulary"` 与首段对 `Source Tag Vocabulary` 的区别说明。
- 断言 catalog 包含 vocabulary 中的核心术语字面量：`query_ready`、`definitions-only`、`dirty-advisory`、`graph-affecting-blocked`、`stale`、`session-local`、`setup-inferred`、`graph_compiled`、`current_session_loaded`、`host_config_written`。
- 断言 catalog 显式说明同义词对（`session-local` 与 `session-local-inference` 至少一处共同出现并标注关系）。
- 断言 catalog 提示了"其他 surface 必须使用上述术语"措辞。

**Verification**: catalog 文件内出现新章节，所有列出术语在表格中可被 grep；contract test pass。

---

### U2. `bootstrap-report.md` 三维度 capability matrix prose（R7 主缺口）

**Goal**: 让 `.spec-first/graph/bootstrap-report.md` 的人类 prose 在 ready/dirty-advisory 主路径中显式展示 query/context · impact_radius · review_support 三维度；blocked 路径与 `bootstrap-impact-capabilities.json` 缺失时不展示。

**Requirements**: R7 [gap→locked-in]，关联 origin AE2、AE3、F2。AE 实施由本 unit 负责，AE2/AE3 的 anti-regression 测试由 U4 负责（避免重复 Covers）。

**Dependencies**: U1（vocabulary 已固化，prose 中可直接使用术语）。

**Files**:
- `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh`（修改 line 3140-3196 与 3199-3225 块）
- `skills/spec-graph-bootstrap/scripts/bootstrap-providers.ps1`（修改 line 3497-3518 块）

**Approach**:
- **sh 端（关键修订）**：
  - line 3140-3196 区间把 `jq -n ... | write_file_atomic` 改为先 `impact_capabilities_json="$(jq -n ...)"`，再 `printf '%s' "$impact_capabilities_json" | write_file_atomic "$IMPACT_DIR/bootstrap-impact-capabilities.json"`。
  - 在 `PRESERVE_CANONICAL_FRESHNESS=true` 且文件已存在的分支补 `impact_capabilities_json="$(cat "$IMPACT_DIR/bootstrap-impact-capabilities.json" 2>/dev/null || printf '{}')"`，确保后续派生 matrix 时变量始终可用。
  - 在 line 3199 附近、`provider_report_rows` 派生之后，新增 `capability_matrix_rows="$(jq -r '...' <<<"$impact_capabilities_json")"`，按 High-Level Technical Design 中的 jq 表达式派生三行。
  - 把 `## Capability Matrix` 表格头与 `$capability_matrix_rows` 追加进 line 3206 的 heredoc 模板尾部。
  - 当 `impact_capabilities_json` 为 `""` 或 `{}` 时跳过 matrix 段落。
- **ps1 端**：
  - line 3499 的 `Write-TextFileAtomic` heredoc 内追加 `## Capability Matrix` 段落。
  - 直接从既有的 `$impactCapabilities.capabilities.{context_selection,impact_radius,review_support}`（line 3444-3478 已构造的 ordered hashtable）派生 `$capabilityMatrixRows`：
    ```powershell
    $capabilityMatrixRows = @(
      "| query/context  | $($impactCapabilities.capabilities.context_selection.support_level) | ..."
      ...
    ) -join [Environment]::NewLine
    ```
  - 当 `$preserveCanonicalFreshness=true` 且 file 已存在但 hashtable 未重新构造时，从磁盘 `Get-Content -Raw | ConvertFrom-Json` 读回。
- blocked 路径（`bootstrap-providers.sh:1263-1269` `write_blocked_report` 与 ps1:136 行附近）保持不变。
- 术语严格用 U1 vocabulary：`definitions-only`、`graph-affecting-blocked` 等。
- Note 列截取 `limitations[]` 首条；空数组时填 `n/a`。

**Patterns to follow**:
- 既有 `provider_report_rows` 的 jq 派生 + heredoc 拼接风格。
- 表格列对齐与既有表格一致。

**Test scenarios** (放在 U4，本 unit 仅负责 prose 实现 + 手工验证):
- 手工 `spec-first init` 后触发 bootstrap，inspect `.spec-first/graph/bootstrap-report.md` 含 `## Capability Matrix` 段落。
- sh 与 ps1 两侧分别 dry-run（macOS/Linux 跑 sh，Windows VM 跑 ps1）。

**Execution note**: 先在 sh 加 capability matrix prose（手工 `spec-first init` 验证），再 mirror 到 ps1，保证双宿主对称由 U4 测试锁定。

**Verification**:
- 当前仓库 `npm run test:integration` graph-bootstrap suite pass；
- 手工：开发者在 source 改完后必须先运行 `spec-first init`（这会把 `skills/spec-graph-bootstrap/scripts/*.{sh,ps1}` mirror 到 `.claude/spec-first/skills/spec-graph-bootstrap/scripts/` 与 `.codex/spec-first/skills/spec-graph-bootstrap/scripts/`），然后通过 host 调用 graph-bootstrap 才能看到新模板生效。仅修改 source 但不 init 会让 host runtime 仍跑旧 mirror。

---

### U3. review-pre-facts definitions-only fixture（R11 升级到 locked-in）

**Goal**: 用 fixture 锁定 `src/cli/helpers/review-pre-facts.js:769-793, 909-918` 的隐式 gating：当 normalized artifacts 的 `available_query_surfaces=["query","context"]`（不含 `impact`、`detect_changes`）时，`query_plan.operations[]` 不发出这两类操作。

**Requirements**: R11 [partial→locked-in]，关联 origin AE5、F4。R15d 的 anti-regression 断言由 U4 在该 fixture 上写入。

**Dependencies**: 无。

**Files**:
- `tests/fixtures/review-pre-facts/provider-status.definitions-only.json`（新增）
- `tests/fixtures/review-pre-facts/graph-facts.definitions-only.json`（新增）
- `tests/fixtures/review-pre-facts/providers/gitnexus/normalized/architecture-facts.definitions-only.json`（新增）
- `tests/fixtures/review-pre-facts/providers/gitnexus/normalized/impact-capabilities.definitions-only.json`（新增）

**Approach**:
- Fixture 文件为 helper `computeReadiness(repoRoot)` 在 tmp git repo 内读取的实际形态（不是 helper arg）。
- `provider-status.definitions-only.json`：含 `providers[0].provider="gitnexus"`、`query_ready=true`、`normalized_artifacts.architecture_facts="providers/gitnexus/normalized/architecture-facts.definitions-only.json"`、`normalized_artifacts.impact_capabilities="providers/gitnexus/normalized/impact-capabilities.definitions-only.json"`、`query_probe_attempts[0].result_class="definitions-only"` + `verification_reason`。
- `graph-facts.definitions-only.json`：含 `source_revision`、`worktree_dirty=false`、`worktree_status_hash` 字段（具体值由测试在 tmp repo 创建后用真实 git rev-parse / status hash 填入，使 helper 走 snapshot match 路径返回 `graph-fresh`）。
- 两个 normalized JSON：`schema_version` + `available_query_surfaces=["query","context"]`，**不含** `impact` 与 `detect_changes`。
- 反向 fixture（可选，放在同一目录）：`impact-capabilities.process-results.json` 含 `available_query_surfaces=["query","context","impact","detect_changes"]`，给 U4 的反向断言用。

**Patterns to follow**:
- 既有 `tests/fixtures/review-pre-facts/provider-raw-result.context.json` 等 fixture 命名风格（注意：那些是 normalize/render mode 的 provider 输出快照，与本 unit 的 prepare-mode fixture 不同；本 unit 用 `.definitions-only.json` 后缀语义化区分）。
- `tests/unit/review-pre-facts-helper.test.js:73-137` `writeGraphArtifacts(repo)` 注入模式。

**Test scenarios**: `Test expectation: none -- 本 unit 仅产出 fixture 文件，断言由 U4 R15d 写入。`

**Verification**: 4 个新文件存在；JSON 合法；`available_query_surfaces` 字段值正确。

---

### U4. R15a-R15f Anti-Regression Test Pack（合并测试加固）

**Goal**: 把 R15a-R15f 共 6 条最小 user-visible test surface 落到既有/新建 suite，按 surface 就近归属，锁定本 plan 与已 locked-in 部分不被未来重构吞掉。本 unit 不动生产代码，只新增/扩展测试与 1 个新 contract test 文件。

**Requirements**: R15a-R15f 全部 [gap/partial→locked-in]，关联 origin AE1-AE6 的 anti-regression 部分；同时锁定 R2/R8/R9/R10/R12/R13 的既有 prose 不被回退。

**Dependencies**: U2（R15a/R15b 测的对象）、U3（R15d 的 fixture）。U4 内部各子测试无技术耦合，可任意顺序实施。

**Files**:
- `tests/unit/spec-graph-bootstrap-contracts.test.js`（扩展，对应 R15a + R15b）
- `tests/unit/review-pre-facts-helper.test.js`（扩展，对应 R15d）
- `tests/unit/version-reminder.sh`（扩展，对应 R15c）
- `tests/unit/mcp-setup.sh`（扩展，对应 R15e）
- `tests/unit/live-mcp-canonical-isolation-contracts.test.js`（**新增**，对应 R15f）

**Approach**:

**R15a — `spec-graph-bootstrap-contracts.test.js`**（locks AE2/AE5）:
- 新增 `describe('result_class enum & availableOperations derivation (R15a)')`。
- 用 inline JSON 字符串 fixture 断言：`provider-status.json` 中 `result_class="definitions-only"` 是合法的 enum 值（既有断言 line 99-109 已部分覆盖，扩展为完整 enum 列表 `process-results | definitions-only | partial-definitions-only`）。
- 反向 fixture（来自 U3 的反向 `impact-capabilities.process-results.json`）断言 `available_query_surfaces` 含 `impact` 时 `availableOperations` 包含 `impact`。

**R15b — `spec-graph-bootstrap-contracts.test.js`**（locks AE2/AE3）:
- 新增 `describe('Capability matrix in bootstrap-report.md (R7/R15b)')`。
- 因 contract test 不实际跑 sh/ps1，使用字符串模板 fixture：mock 一个 `bootstrap-impact-capabilities.json` 内容含三维度，断言 sh 与 ps1 模板源码（直接 read 两个 script 文件）都包含 `## Capability Matrix` 字面量、三个 capability 行的字面量（`query/context`、`impact_radius`、`review_support`）、term-inclusion 一致性（双宿主测试）。
- AE3 dirty-advisory 路径的覆盖通过断言 sh:3211 / ps1:3504 计算 `freshness_state=dirty-advisory` 的代码路径 reachable 时 matrix 不被吞掉（由 sh / ps1 模板字符串包含 `freshness_state` 与 `## Capability Matrix` 同时出现的字面量验证）。
- 双宿主对称采用 **term-inclusion 比较**：核心术语字面量（capability 名、状态枚举值、limitations 关键词）在 sh 与 ps1 输出模板中都必须出现；不要求 byte-exact（heredoc 换行与 PowerShell `[Environment]::NewLine` 差异不算违反）。

**R15c — `version-reminder.sh`**（locks AE4 startup snapshot 部分）:
- 在既有 `graph_snapshot_fresh` 案例（line 540-627）后追加：
  - `graph_snapshot_dirty_advisory`（dirty=dirty + freshness=stale + capabilities 不变）
  - `graph_snapshot_query_unavailable`（`query_ready=false` → `capabilities=query/context=none, impact=none, review=none`）
  - `graph_snapshot_partial_impact`（`impact_radius.support_level=partial`）
  - `graph_snapshot_canonical_missing`（`.spec-first/graph/*` 不存在 → snapshot 退化措辞）
- 沿用既有 `assert_contains` + 内联 JSON fixture pattern。

**R15d — `review-pre-facts-helper.test.js`**（locks AE5 R11 gating）:
- 新增 `describe('Definitions-only gating (R11/R15d)')`。
- 用 `writeGraphArtifacts(tmpRepo, U3 fixture)` 把 4 个 fixture 文件内容写入 tmp git repo 的对应 `.spec-first/...` 路径。
- 调用 `runReviewPreFacts({ repoRoot: tmpRepo, mode: 'prepare' })`，断言：
  - `query_plan.operations[]` 至少含一个 `query` 操作。
  - `query_plan.operations[]` 至少含一个 `context` 操作。
  - **不含**任何 `impact`、`detect_changes`、`route_map`、`api_impact`、`shape_check`、`tool_map`、`cypher`、`group_sync`、`rename` 操作。
- 反向断言：把 normalized artifact 改为 process-results 形态，期望 `query_plan.operations[]` 含 `impact`，证明 gating 不是误把所有 impact 都关掉。
- 边界：normalized artifact 缺失文件时 helper 退化为 query-only（不抛错）。

**R15e — `mcp-setup.sh`**（locks AE1 R1/R4/R5 setup prose）:
- 新增两组 case：`graph_ready_pending` 与 `graph_ready_ready`。每组用 stub 工程注入对应 graph readiness 状态，运行 setup helper 或直接 grep `skills/spec-mcp-setup/SKILL.md` 模板渲染输出。
- 两组都断言：(a) "重启 Claude Code/Codex 或新开会话" 字串；(b) "deterministic CLI compilation" 字串；(c) `Execution result` 或 `Required Harness Runtime` 表头。

**R15f — `live-mcp-canonical-isolation-contracts.test.js`**（**新建**, locks AE4 boundary）:
- 新建独立 contract test 文件（feasibility reviewer 已确认 `no-graph-fast-path-contracts.test.js` 是纯 doc-string 比对，与 hash before/after pattern 不兼容）。
- 测试模式（不真实调用 GitNexus，遵守 spec-plan boundary）：
  - 在 tmp repo 创建 fixture canonical artifacts（`.spec-first/graph/provider-status.json`、`graph-facts.json`、`.spec-first/impact/bootstrap-impact-capabilities.json`、`.spec-first/providers/gitnexus/normalized/*`）。
  - 计算 before sha256：`crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex')`。
  - 调用 `runReviewPreFacts({ repoRoot: tmpRepo, mode: 'prepare' })` 或其他 read-only mode（不调用任何 MCP server）。
  - 计算 after sha256，断言 each canonical path before == after。
- 沿用 `tests/unit/multi-actor-worktree-governance-contracts.test.js:63-69` 的 hash before/after pattern。

**Patterns to follow**:
- contract test 用 jest + `expect(...).toContain(...)` 风格（对应 `spec-graph-bootstrap-contracts.test.js`）。
- Shell test 用 `assert_contains` 与内联 JSON fixture（对应 `version-reminder.sh`、`mcp-setup.sh`）。
- `crypto.createHash('sha256')` hash before/after 对应 `multi-actor-worktree-governance-contracts.test.js`。

**Test scenarios** (集合式列出，每条对应一个子 test):
- **Locks AE2 against regression.** definitions-only 输入 → bootstrap-report 模板出现 `## Capability Matrix` 三维度。
- **Locks AE3 against regression.** dirty-advisory 路径下 capability matrix 不被吞掉。
- **Locks AE4 against regression（snapshot 部分）.** startup snapshot 在 4 种状态组合下输出固定 capabilities/limitations 措辞。
- **Locks AE4 against regression（isolation 部分）.** review-pre-facts read-only mode 不修改 canonical artifacts hash。
- **Locks AE5 against regression.** definitions-only 输入下 query_plan 不含 impact/detect_changes；process-results 输入下含 impact。
- **Locks AE1 against regression.** setup 双路径都含 restart 提示与 deterministic compilation 措辞。

**Verification**: `npm run test:unit` pass（包含新建 file 与扩展 file）；`bash tests/unit/version-reminder.sh` 与 `bash tests/unit/mcp-setup.sh` 全部 assertion pass。

---

### U5. README/CHANGELOG vocabulary 对齐 + Changelog 收尾

**Goal**: 把 README.md / README.zh-CN.md 中的 capability 措辞对齐到 U1 集中固化的 vocabulary，加 cross-ref；并在 `CHANGELOG.md` 追加本工作的 user-visible 变更记录。

**Requirements**: R14 [partial→locked-in]（合并 U1 的 vocabulary 集中后由本 unit 收尾），关联 origin AE6；governance（CLAUDE.md "Changelog" 段落）。

**Dependencies**: U1（glossary 必须先存在才能引用）、U2（bootstrap-report 改动是 user-visible 变更需在 CHANGELOG 记录）、U3、U4（CHANGELOG 同时记录 fixture 与测试加固）。

**Files**:
- `README.md`（修改）
- `README.zh-CN.md`（修改）
- `CHANGELOG.md`（追加）
- `tests/unit/runtime-capability-catalog.test.js`（扩展，断言 README cross-ref）

**Approach**:

**README 对齐**:
- 先 grep README.md / README.zh-CN.md 中提到 GitNexus、graph readiness、query_ready、definitions-only、capability、impact、live MCP 的段落（≤10 处），对照 U1 vocabulary 检查每处用词。
- 同义词或歧义措辞统一替换为 vocabulary 中的术语；至少在第一次提到 GitNexus capability/readiness 的段落附近加一行：
  > 完整的 capability/readiness 状态术语见 `docs/contracts/gitnexus-capability-catalog.md` 的 "Capability State Vocabulary" 章节。
- 改动幅度限制 ≤30 行；只做术语对齐 + 一条 cross-ref；不动 README 主结构。
- 若实施时发现 README 改动量超过 30 行，停下并把超出部分留作 follow-up plan。

**Contract test 扩展（`tests/unit/runtime-capability-catalog.test.js`）**:
- 断言 README 与 README.zh-CN 都包含 cross-ref 字符串 `gitnexus-capability-catalog.md` 与 `Capability State Vocabulary`。
- 断言 vocabulary 关键术语（`query_ready`、`definitions-only`、`dirty-advisory`、`session-local`）在 README 中至少各出现 1 次。

**CHANGELOG entry**:
- 用当前 host developer profile（`.claude/spec-first/.developer` 或 `.codex/spec-first/.developer`）。
- 单条 entry，category `feat`，标题：`gitnexus: capability semantics 集中固化与 bootstrap-report 三维度 surfacing`。
- 内容覆盖：U1 vocabulary 集中、U2 bootstrap-report capability matrix（user-visible）、U3 fixture、U4 anti-regression 测试、README 对齐。
- 标 `(user-visible)` 因为 bootstrap-report.md 与 README 是用户直接读到的产物。

**Patterns to follow**:
- README.zh-CN.md 既有的中文 prose + 反引号术语风格。
- CHANGELOG.md 既有的 entry 格式（开头日期 / category / Author / 列表）。

**Test scenarios** (在 `runtime-capability-catalog.test.js`):
- **Locks AE6.** README.md 与 README.zh-CN.md 都包含 cross-ref。
- README 中 capability vocabulary 关键术语至少各出现 1 次。
- CHANGELOG entry 包含 `(user-visible)` 标记与本工作的描述（grep）。

**Verification**: `npm run test:unit` pass；手工 diff README 改动 ≤30 行；`git diff CHANGELOG.md` 显示一条新 entry。

---

## Sequencing & Dependencies

```text
U1 (vocabulary)  ──┬──>  U2 (bootstrap-report matrix)  ──>  U4 (anti-regression test pack)
                   ├──>  U5 (README + CHANGELOG)
                   └──> （U3 也可在此后开始,U3 与 U2 互不耦合）

U3 (review-pre-facts fixture)  ──> U4 R15d 子测试

U2, U3, U4  ──> U5 (CHANGELOG 收尾)
```

执行建议顺序：U1 → U2 → U3（与 U2 并行可）→ U4 → U5。

注：U-ID 在 plan v2 整合 reviewer findings 时从 v1 的 U1-U8 重排为 U1-U5；这是 plan 在 doc-review 阶段的合并/重写，不是 settled 后的 renumber。下游 spec-write-tasks/spec-work 尚未消费 v1，因此重排是安全的。

---

## Scope Boundaries

### In scope
- Origin 中 R1/R7/R11/R14 的实质 surfacing/glossary 工作；R15a-R15f 全部测试覆盖；其余 R2-R6/R8-R10/R12/R13 的 anti-regression 测试触达（落在 U4 中）。

### Deferred for later
- 让 GitNexus 提供 process graph / impact 真实证据。
- 把 capability vocabulary 渗透到 spec-plan/spec-work/spec-debug/spec-code-review/spec-doc-review 的 SKILL.md prose（这些 skill 已使用相同术语；如未来发现漂移，单独立 plan 收敛）。
- 把 `live-mcp-tool` / `live-mcp-resource` 的 session-local evidence 写入更结构化的 `.spec-first/sessions/*` artifact。

### Outside this product's identity
- spec-first 不打算成为 GitNexus 的 wrapper / 替代图谱产品；本工作只规范 spec-first 自身对 GitNexus capability 的 surfacing。
- spec-first 不打算自动 refresh / repair / sync GitNexus graph。

### Deferred to Follow-Up Work
- 若 U2 落地后发现 `bootstrap-impact-capabilities.json` 字段不足以渲染所需 prose（如缺中文摘要字段），可在另起 plan 扩展 schema；本 plan 不主动扩展。
- 若 U5 的 README 改动量 >30 行，超出部分留作 follow-up plan。

---

## Risk Analysis & Mitigation

| 风险 | 严重度 | 触发条件 | 缓解 |
|---|---|---|---|
| 双宿主 sh/ps1 不对称（U2） | 高 | 只改 sh 没 mirror 到 ps1，Windows 路径 bootstrap-report 缺 capability matrix | U4 R15b 中的 term-inclusion 双宿主断言：sh 与 ps1 模板都必须含 `## Capability Matrix` 与三个 capability 行字面量；CI 同时跑 `*.sh` 与 `*-powershell-contracts.test.js` |
| sh 端 PRESERVE_CANONICAL_FRESHNESS 路径下 `impact_capabilities_json` 未填（U2） | 高 | freshness preserve 路径下 jq 块跳过，未读回已有文件，导致 matrix 段落空 | U2 Approach 已要求该路径 `cat` 回读；U4 R15b 应至少覆盖 fresh + dirty-advisory + preserve-canonical 三种 sh 路径 |
| Vocabulary 集中后被复制粘贴扩散（U1） | 中 | 后续开发者把 vocabulary 复制到其他文件而非 cross-ref | U1 测试断言"其他 surface 必须使用上述术语"措辞；U5 contract test 检查 README 含 cross-ref |
| `bootstrap-impact-capabilities.json` 字段缺失导致 U2 渲染空表 | 中 | dirty-advisory 路径下 jq 派生失败 | jq 表达式加 `// "n/a"` 默认值；blocked 路径不渲染 matrix（已在 Approach 中明确）；U4 R15b 加缺失文件分支断言 |
| Fixture 漂移（U3） | 中 | `.spec-first/graph/*` schema 演化导致 fixture 过期 | Fixture 含 schema_version 字段；U4 R15a 同时断言 schema 兼容；fixture 文件名含 `definitions-only` 语义标识 |

---

## Verification Strategy

| 用户视角 | 验证手段 |
|---|---|
| 人类操作员看 bootstrap-report.md 即可一眼看到 query/context/impact/review 三维度（origin 成功标准 1） | U2 落地 + 手工运行 `spec-first init` 同步 source 到 runtime mirror，再触发 bootstrap，inspect `.spec-first/graph/bootstrap-report.md` |
| 下游 agent 不会因为 query_ready=true 就自启用 impact/detect_changes（origin 成功标准 2） | U3 fixture + U4 R15d pass |
| `review-pre-facts` 不再 imply impact/detect_changes 是 primary（origin 成功标准 3） | U4 R15d + 既有 review-pre-facts contract test |
| README/skill/contract 用同一套术语（origin 成功标准 4） | U1 + U5 contract test |

整体验证命令：

- `npm run typecheck`
- `npm run test:unit`
- `npm run test:integration`
- 手工：在 dirty 仓库与 clean 仓库下分别 `spec-first init`，diff `.spec-first/graph/bootstrap-report.md` 含 `## Capability Matrix` 段落且术语与 vocabulary 一致。

---

## Operational / Rollout Notes

- 改动均为 source-side（contract、skill 内 sh/ps1、tests、README/CHANGELOG），不触及 generated runtime mirror（`.claude/`、`.codex/`、`.agents/skills/`）。
- **本仓库开发者本地验证**：完成 U2 改动后必须先 `spec-first init` 把 source 同步到本仓库的 `.claude/spec-first/skills/spec-graph-bootstrap/scripts/` 与 `.codex/spec-first/skills/spec-graph-bootstrap/scripts/`，再运行 `bash tests/unit/spec-graph-bootstrap.sh` 或手工触发 graph-bootstrap 才能在自己的 host 看到效果。仅修改 source 但不 init 会让 host runtime 仍跑旧 mirror。
- **下游用户**：通过 `npm install -g @spec-first/cli@latest` + `spec-first init` 获得新 bootstrap-report 模板。
- 本工作不要求 host session restart（无 MCP 配置变更）。
- 不影响在跑的 CI/CD：测试新增不会让既有 case 失败；唯一可能的硬失败是 U2 bootstrap-report 模板改动后既有 grep 断言可能需要同步更新（U4 R15b 同步处理）。

---

## Implementation Reality Snapshot Reference

详见 origin 文档的 "Implementation Reality Snapshot" 章节（同 spec_id），记录 R1-R15 在本 plan 提交前的 locked-in / partial / gap 分布与具体 file_path:line_number 证据。本 plan 不重复该表，只在 U1-U5 的 Requirements 字段标注从 partial/gap → locked-in 的状态迁移。

---

## Plan v2 Integration Notes

本 plan v2 整合了 doc-review 阶段三 reviewer 的 findings：

- **Coherence (BLOCK + 5 FLAG)**: 修复 R14 标注矛盾（U1 标 R1 partial→locked-in、R14 由 U5 收尾 partial→locked-in；不再两处冲突）；统一 vocabulary 术语为 "Capability State Vocabulary 章节"；引入 AE Coverage Map 避免 unit 间重复 Covers；blocked 路径措辞在三处统一为"`bootstrap-impact-capabilities.json` 缺失或所有 support_level 为空时跳过 matrix 段落"。
- **Scope (FLAG)**: 合并原 U3+U5+U6 为 U4 anti-regression test pack（按 suite 分子节）；合并原 U7+U8 为 U5 docs alignment + CHANGELOG；删除 Documentation Plan 否定列表（合并进 Non-Goals）；Risk 表瘦身去除 governance baseline 类低信息项；删除 Open Questions 中的 micro-decision（i18n 截断、sha256 vs sha1）。
- **Feasibility (3 critical + 2 minor)**: U2 修订 sh 端实际变量名（直接管道 → capture+pipe），ps1 端用既有 `$impactCapabilities` hashtable；U3 fixture 改为 normalized artifact 形态（`available_query_surfaces[]` 才是 helper 真正读的字段，`result_class` 与 `support_level` 是 dead inputs）；U4 R15f 新建 `live-mcp-canonical-isolation-contracts.test.js`，不复用 `no-graph-fast-path-contracts.test.js`（pattern 不兼容）；U1 章节插入位置改为 "Verification Posture" 之后；U2 Verification 补开发者本地验证流程（`spec-first init` 同步 mirror）。
