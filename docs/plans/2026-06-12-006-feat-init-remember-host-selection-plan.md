---
title: "feat: init 记住上次 host 选择并自动预勾选"
type: feat
status: completed
date: 2026-06-12
spec_id: 2026-06-12-001-init-host-selection-remember-last
origin: docs/brainstorms/2026-06-12-001-init-host-selection-remember-last-requirements.md
---

# feat: init 记住上次 host 选择并自动预勾选

## Summary

在全局 developer 文件 `~/.spec-first/.developer` 中新增一个 host 选择字段，交互式 `spec-first init` 完成后把用户实际勾选的 host 列表写入该字段，下次交互渲染 host 多选框时回填为默认勾选态。首次安装（无该字段）保持现状全空。

---

## Decision Brief

- **Recommended approach:** 把"上次 host 选择"作为新字段并入既有全局 developer 文件读写链路（`src/cli/developer.js`），交互安装时读它来设置 checkbox 的 `checked`，安装完成时把当前选择写回。
- **Key decisions:** 字段键名用 `hosts`（与"宿主运行时"措辞一致）；记忆是全局共享一份（与用户名同源）；持久化"用户勾选列表"而非"磁盘已装 runtime"。
- **Validation focus:** developer 文件新字段的 round-trip 与对不支持 host 的忽略；交互回填预勾选；**name/lang 未变的 re-install 路径上 host 变更仍能持久化**（最易漏的 preserve 分支）。
- **Largest risks / boundaries:** 现有 `resolveGlobalDeveloperWriteAction` 在 name+lang 未变时返回 `preserve` 且不写文件——这是最常见的重装路径，若不处理则 host 变更不会落盘。

---

## Problem Frame

`spec-first init` 是反复运行的命令（升级 CLI、修复 runtime drift、重装资产）。每次交互安装，host 多选框两项（`INIT_PLATFORM_CHOICES`，均硬编码 `defaultChecked: false`）都全空呈现，从不回填上次选择，对固定使用单一 host 或固定组合的用户是可消除的重复操作。命令已把用户名/语言持久化到全局 developer 文件，host 选择却未被记住。详见 origin: `docs/brainstorms/2026-06-12-001-init-host-selection-remember-last-requirements.md`。

---

## Requirements

- R1. 交互式 init 完成后，把本次勾选的 host 列表写入全局 developer 文件，与 `name`/`lang` 并列。
- R2. 持久化的是用户实际勾选的列表，而非当前项目实际安装的 runtime 目录状态。
- R3. 交互渲染 host 多选框时读取记录并把每个 host 预勾选。
- R4. 文件不存在或无该字段（首次）时多选框保持现状全空。
- R5. 记录中已不受支持的 host 标识回填时安全忽略，不报错、不影响其余预勾选。
- R6. 不改变 `--yes` 非交互路径行为（默认仍由 `defaultForYes` 决定）。
- R7. 显式 `--claude`/`--codex` flag 指定 host 时按现状直接采用，不进多选框、不受记录影响。

**Origin acceptance examples:** AE1 (covers R3, R1), AE2 (covers R4), AE3 (covers R2, R3), AE4 (covers R5), AE5 (covers R6)。

---

## Scope Boundaries

- 不做 per-project host 记忆——记忆全局共享一份。
- 不用"扫描已安装 runtime 目录"决定预勾选——按持久化的用户选择回填。
- 不改首次安装默认勾选态（不做"首次默认全勾"）。
- 不改 `--yes` 与显式 flag 路径既有行为。
- 不引入新独立配置文件或新 CLI flag。

---

## Direct Evidence Readiness

- target_repo: spec-first（当前仓库，单 git 仓库）
- evidence_sources: direct source reads, rg, codegraph
- source_refs: `src/cli/developer.js`, `src/cli/commands/init.js`, `src/cli/init-i18n.js`, `src/cli/prompts/index.js`, `tests/unit/init-interactive.test.js`
- current_revision: 分支 `leo-2026-06-11-plan-update`
- worktree_status: dirty（与本计划无关的既有改动）
- confidence: high
- limitations: 未实际运行 init 的端到端交互；行为以源码读证为准

---

## Direct Evidence

- repo_scope: `src/cli/`（init + developer + prompts + i18n）与 `tests/unit/`
- source_reads_completed:
  - `src/cli/developer.js` —— 全局文件读写：`readDeveloperFile`/`parseDeveloperContents`/`writeGlobalDeveloperFile`/`formatDeveloperContents`/`normalizeDeveloper`，字段集 `name`/`lang`/`initializedAt`/`version`，文件格式为 `key=value` 行。
  - `src/cli/commands/init.js` —— `collectInitInput`（host 多选框在 ~L332，硬编码 `checked: choice.defaultChecked`）、`INIT_PLATFORM_CHOICES`（L76，均 `defaultChecked:false`）、`buildInitPlan`（per-platform，~L700）、`resolveGlobalDeveloperWriteAction`（L1940）、`applyGlobalDeveloperProfileWrite`（L939）、多平台应用循环（L162-163）。
  - `src/cli/prompts/index.js` —— `checkbox` 支持按选项 `checked` 初始化 `checkedIndexes`（L57-62），回填能力已具备。
  - `src/cli/init-i18n.js` —— `selectHosts`/`checkboxHint` 文案（zh/en）。
  - `tests/unit/init-interactive.test.js` —— 既有 promptApi mock：`checkbox` 默认 resolve 传入 platforms，`select`/`confirm`/`textInput` 分流。
- commands_or_tools_used: rg, codegraph_explore, Read
- impact_on_plan: 三个关键结论——(1) host 选择列表在 `collectInitInput` 层已知（`input.platforms`），但 `buildInitPlan` 是 per-platform，需把完整列表下传；(2) 全局写在每个 per-platform plan 内重复执行（内容相同、幂等）；(3) **`resolveGlobalDeveloperWriteAction` 在 name+lang 未变时返回 `action:'preserve'` 且 `applyGlobalDeveloperProfileWrite` 只在 create/overwrite 时写文件**——这是最常见的重装路径，host 变更需在此路径也能落盘。
- source_reads_required: 无（实现期再定具体键名/序列化细节）
- key_findings: 见 impact_on_plan
- limitations: 未覆盖 `update` 命令是否也走 developer 写入（本计划只承诺 init 交互路径，R 范围内）

---

## Context & Research

### Relevant Code and Patterns

- `src/cli/developer.js`：所有全局 developer 文件读写与 normalize 的单一入口；新字段必须在 `parseDeveloperContents`、`normalizeDeveloper`、`formatDeveloperContents` 三处一致处理。
- `src/cli/commands/init.js` `collectInitInput`：host 多选框构造点，`checked` 当前恒为 `choice.defaultChecked`。
- `src/cli/prompts/index.js` `checkbox`：已按选项 `checked` 渲染预勾选，无需改动 prompt 层。

### Institutional Learnings

- 未发现 `docs/solutions/` 中直接相关条目；按 CLAUDE.md「light contract / source-first / 确定性事实由脚本，语义由 LLM」执行。

---

## Key Technical Decisions

- **字段键名 `hosts`，值为逗号分隔的受支持 host id**（如 `hosts=claude,codex`）：与"宿主运行时"措辞一致，单行 `key=value` 与现有文件格式同构，`parseDeveloperContents` 可直接消费。规范化时按 `INIT_PLATFORM_CHOICES` 已知 id 过滤、去重、排序，满足 R5。
- **持久化数据源 = `input.platforms`（用户勾选列表），不读磁盘 runtime 状态**：满足 R2/AE3。
- **修复 preserve 分支**：`resolveGlobalDeveloperWriteAction` 在 name/lang 未变但 hosts 发生变化时应升级为写动作（保留既有 name/lang，仅更新 hosts），否则最常见的重装路径无法持久化新选择。这是本计划的核心正确性点。
- **回填仅作用于交互多选框**：`--yes`（走 `defaultInitPlatforms`）与显式 flag（走 `parsed.platforms`）路径不经过多选框，天然满足 R6/R7。

---

## Open Questions

### Resolved During Planning

- 是否需要改 prompt 层支持预勾选？否——`src/cli/prompts/index.js` 的 `checkbox` 已支持选项 `checked`。
- 记忆放哪个文件？全局 `~/.spec-first/.developer`（用户已确认"与用户名同一文件"）。

### Deferred to Implementation

- `hosts` 字段在多平台安装时由每个 per-platform plan 重复写入（内容一致、幂等）——确认无需提取为单次写入，保持现有 per-plan 写入结构即可，除非实现期发现重复写有副作用。
- `normalizeDeveloper` 的 `null`（空对象）判定当前依据 name/lang/initializedAt/version 全空——确认新增 `hosts` 是否纳入该"全空"判定，避免仅有 hosts 时被判为 null。

---

## Implementation Units

### U1. developer 文件模型新增 hosts 字段

**Goal:** 让全局 developer 文件能解析、规范化、序列化 `hosts` 字段，并对不受支持的 host id 安全忽略。

**Requirements:** R1, R2, R5

**Dependencies:** None

**Files:**
- Modify: `src/cli/developer.js`
- Test: `tests/unit/developer.sh`（既有 shell 测试）或新增 `tests/unit/developer.test.js`（实现期择一，优先扩展既有）

**Approach:**
- `parseDeveloperContents`：读取 `hosts` 行，按逗号拆分。
- 新增/扩展规范化：按受支持 host id 集合（来源见下）过滤、去重、稳定排序；非法/未知 id 丢弃（R5）。
- `formatDeveloperContents`：当 hosts 非空时输出 `hosts=...` 行；为空则不输出该行（保持首次/无记录的干净文件）。
- `normalizeDeveloper`：将 hosts 纳入对象；复核"全空判 null"逻辑，避免仅有 hosts 时被误判。
- 受支持 host id 集合：避免 `developer.js` 反向依赖 `commands/init.js`，由调用方（U3）传入已选 host，或在 `developer.js` 内维护一份最小常量（`['claude','codex']`）。实现期择最轻方案；优先调用方传入以保持 `INIT_PLATFORM_CHOICES` 为单一事实源。

**Patterns to follow:**
- 现有 `parseDeveloperContents`/`formatDeveloperContents`/`normalizeDeveloper` 的 key=value 行处理与 `normalizeText` 风格。

**Test scenarios:**
- Happy path: 写入含 `hosts=claude,codex` 的对象后回读，hosts 数组等于 `['claude','codex']`。Covers AE1。
- Edge case: 无 `hosts` 行的旧文件回读，hosts 为空（不报错）。Covers AE2。
- Edge case: `hosts=claude,bogus,claude` 回读后规范化为 `['claude']`（忽略未知、去重）。Covers AE4。
- Edge case: 仅有 hosts、无 name/lang 时对象不被误判为 null。

**Verification:**
- developer 文件读写对 hosts 字段 round-trip 正确，旧文件向后兼容，未知 id 被忽略。

---

### U2. 交互多选框按记录预勾选

**Goal:** 交互式 init 渲染 host 多选框时，读取全局记录把每个已记录且受支持的 host 预勾选；首次/无记录保持全空。

**Requirements:** R3, R4, R5, R6, R7

**Dependencies:** U1

**Files:**
- Modify: `src/cli/commands/init.js`（`collectInitInput` 中 host 多选框构造）

**Approach:**
- 在多选框分支（`parsed.platforms` 为空且非 `--yes`）读取全局 developer 的 hosts 记录。
- 构造选项时 `checked` = `choice.defaultChecked || rememberedHosts.includes(choice.id)`；无记录时退化为现状（全 false，满足 R4）。
- 仅在交互多选框路径生效；`--yes`（`defaultInitPlatforms`）与显式 flag（`parsed.platforms`）路径不触及，天然满足 R6/R7。
- 复用已有的全局读取（`readDeveloperFile(getGlobalDeveloperPath())`，`collectInitInput` 内已多处使用），避免重复 IO 抽象。

**Patterns to follow:**
- `collectInitInput` 中既有 `readDeveloperFile`/`resolveDeveloperDefaults` 的读取方式；`prompts/index.js` `checkbox` 的 `checked` 语义。

**Test scenarios:**
- Happy path: 全局记录 `hosts=claude`，交互 init 时传给 checkbox 的选项中 claude `checked:true`、codex `checked:false`。Covers AE1, AE3。
- Edge case: 无全局文件/无 hosts 字段时两项均 `checked:false`。Covers AE2。
- Edge case: 记录含未知 host id 时仅受支持项被预勾选。Covers AE4。
- Edge case（保证不回归）: `--yes` 路径不经过多选框，仍走 `defaultInitPlatforms`。Covers AE5。

**Verification:**
- 交互重装时 checkbox 预勾选反映上次选择；首次安装行为不变。

---

### U3. 安装完成时持久化所选 host（含 preserve 路径修复）

**Goal:** init 完成后把用户实际勾选的 host 列表写入全局 developer 文件，且在 name/lang 未变的常见重装路径上，host 变更仍能落盘。

**Requirements:** R1, R2

**Dependencies:** U1

**Files:**
- Modify: `src/cli/commands/init.js`（`buildInitPlans`/`buildInitPlan` 下传所选 host；`resolveDeveloperIdentity` 调用处或 developer 组装处并入 hosts；`resolveGlobalDeveloperWriteAction`/`applyGlobalDeveloperProfileWrite`）
- 可能 Modify: `src/cli/developer.js`（若 `resolveDeveloperIdentity` 需接收并写出 hosts）

**Approach:**
- 把完整所选列表 `input.platforms` 经 `buildInitPlans` 下传 `buildInitPlan`（如 `selectedHosts`），再并入构建出的 developer 对象的 hosts 字段（数据源是勾选列表，非磁盘状态，满足 R2）。
- **修复 preserve 分支**：`resolveGlobalDeveloperWriteAction` 目前在 `sameName && sameLang` 时返回 `preserve` 且不写文件。改为：比较"期望 developer（既有 name/lang + 新 hosts）"与磁盘 existing；当 hosts 变化时升级为写动作（保留既有 name/lang，仅更新 hosts）。`applyGlobalDeveloperProfileWrite` 相应在该情形执行写入。
- 多平台安装时每个 per-platform plan 写入相同 hosts 列表（幂等），保持现有 per-plan 写入结构（见 Deferred to Implementation）。
- 保持 `create`/`overwrite`/`preserve` 既有摘要输出语义；新增的 hosts 更新可复用 overwrite 或新增轻量动作，实现期择一，优先复用以减小表面积。

**Patterns to follow:**
- `resolveGlobalDeveloperWriteAction` 现有 create/overwrite/preserve 三分支；`applyGlobalDeveloperProfileWrite` 的写入闸门。

**Test scenarios:**
- Happy path: 交互勾选 claude 完成后，全局文件含 `hosts=claude`。Covers AE1。
- Integration: 既有全局文件 name/lang 不变、上次 `hosts=claude`，本次勾选 `claude,codex` 完成后文件 hosts 更新为 `claude,codex`（验证 preserve 路径修复——核心正确性场景）。
- Edge case: 手动删除某 runtime 目录后再装，写入的仍是本次勾选列表而非磁盘扫描结果。Covers AE3。
- Edge case（不回归）: 仅 name/lang 与 hosts 都未变时不产生无谓 overwrite（避免抖动 initialized_at/version 语义）。

**Verification:**
- 重装后 `~/.spec-first/.developer` 的 hosts 字段等于本次勾选；name/lang 未变的重装路径上 host 变更也能持久化。

---

### U4. 文档与 changelog

**Goal:** 同步用户可见行为变更与 source 变更记录。

**Requirements:** R1, R3（用户可见行为）

**Dependencies:** U1, U2, U3

**Files:**
- Modify: `CHANGELOG.md`（作者读 `~/.spec-first/.developer`，追加 `(user-visible)`）
- 评估 Modify: `docs/05-用户手册/12-gitignore参考.md` 无关；相关用户手册若描述 init 交互流程则补一句预勾选行为（实现期确认是否存在对应小节，无则跳过）

**Approach:**
- CHANGELOG 记录"init 交互安装记住并预勾选上次 host 选择"。
- 检索用户手册中是否有 init 交互安装的描述小节，有则补充预勾选说明；无则不新建。

**Patterns to follow:**
- 仓库现行 CHANGELOG 条目格式与 developer profile 作者解析。

**Test scenarios:**
- Test expectation: none —— 文档/changelog 变更，无行为断言。

**Verification:**
- CHANGELOG 含本次用户可见变更条目，格式符合仓库现行规范。

---

## System-Wide Impact

- **Interaction graph:** 仅 `spec-first init` 交互路径与全局 developer 文件读写；`doctor`/`changelog 作者解析` 读同一文件但只消费 name/lang，对新增 hosts 字段无感（向后兼容）。
- **State lifecycle risks:** 全局文件是单文件覆盖写；多平台安装重复写相同内容为幂等，无部分写风险。
- **API surface parity:** `.developer` 文件是跨 init/doctor/changelog 的隐式格式契约；新增字段为可选、向后兼容，旧版本读取忽略未知行。
- **Unchanged invariants:** `--yes` 与显式 flag 的 host 选择行为、name/lang 解析与写入语义、首次安装全空默认均不变。

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| preserve 分支遗漏导致最常见重装路径不持久化 host 变更 | U3 显式修复并以 integration 测试覆盖 name/lang 不变但 hosts 变化的场景 |
| `normalizeDeveloper` 全空判 null 因新增字段产生回归 | U1 测试覆盖"仅 hosts"对象；复核 null 判定纳入 hosts |
| 旧版本 CLI 读到新 `hosts` 行 | 格式为可选 key=value 行，解析忽略未知 key，向后兼容 |
| `developer.js` 反向依赖 `commands/init.js` 造成耦合 | 受支持 host 集合优先由调用方传入，保持 `INIT_PLATFORM_CHOICES` 单一事实源 |

---

## Documentation / Operational Notes

- 按 CLAUDE.md 要求：source 变更同步 `CHANGELOG.md`（`(user-visible)`），作者取全局 developer profile。
- 双宿主：本变更只动通用 init 交互与全局文件，不涉及 Claude/Codex runtime 生成差异。

---

## Sources & References

- **Origin document:** [docs/brainstorms/2026-06-12-001-init-host-selection-remember-last-requirements.md](docs/brainstorms/2026-06-12-001-init-host-selection-remember-last-requirements.md)
- Related code: `src/cli/developer.js`, `src/cli/commands/init.js`, `src/cli/prompts/index.js`, `src/cli/init-i18n.js`
- Related tests: `tests/unit/init-interactive.test.js`, `tests/unit/developer.sh`
