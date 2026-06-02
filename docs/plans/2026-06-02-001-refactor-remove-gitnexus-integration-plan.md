---
title: "refactor: 彻底移除 GitNexus 集成"
type: refactor
status: active
date: 2026-06-02
spec_id: 2026-06-02-001-refactor-remove-gitnexus-integration
---

# refactor: 彻底移除 GitNexus 集成

## Summary

将 spec-first 中所有 GitNexus 专属代码、workflow、测试、契约文档和历史文档引用完整移除。移除后，spec-first 仍是完整的 workflow harness，但不再依赖任何图谱 provider——各 workflow 的上下文理解回退到 grep/Read 直读模式，`spec:graph-bootstrap` 命令消失。

---

## Problem Frame

上一分析会话（见会话 transcript `2026-06-02-150315-spec-firstgitnexus.txt`）对 GitNexus 集成侵入性做了完整勘察，发现：

- 运行时协议层（facts/降级/零硬依赖）本身设计干净
- 但 `spec-first init` 无条件向每个仓库注入 `# GitNexus — Code Intelligence` 指令块，与图谱是否可用无关
- `gitnexus` 品牌名硬编码进入口文档（CLAUDE.md/AGENTS.md）、6 个核心 workflow skill prose、readiness 查找逻辑，导致一个外部 provider 在 source 层被当成了"图谱能力"本身

分析提出三条路径：A 彻底清除、B 去品牌化+默认关闭、C 仅修指令块注入。用户明确选择路径 A。

---

## Requirements

- R1. 移除所有 GitNexus 专属 JS 源码模块
- R2. 移除 `spec:graph-bootstrap` workflow（`skills/spec-graph-bootstrap/`）
- R3. 移除 review-pre-facts 证据消费层（`src/cli/helpers/review-pre-facts/`）
- R4. `spec-first init` 不再向宿主注入 GitNexus 指令块
- R5. 6 个核心 workflow skill 的 SKILL.md 移除 GitNexus/review-pre-facts 引用，保留 grep/Read 直读作为唯一上下文路径
- R6. `using-spec-first` 路由表和场景指纹检测移除 GitNexus/graph-bootstrap 条目
- R7. 移除所有 GitNexus 相关单测和测试 fixtures
- R8. 从 `package.json` 的 files 白名单移除已删契约文档
- R9. 历史规划文档（docs/brainstorms/、docs/plans/）清理 GitNexus 引用
- R10. CHANGELOG 记录本次 breaking change（user-visible）
- R11. `npm run typecheck` + `npm run test:unit` + `npm run test:smoke` 全部通过

---

## Scope Boundaries

- 不修改 `docs/brainstorms/` 和 `docs/plans/` 中的历史档案文件（仅清理其中的 gitnexus 引用段落，不删除文件）
- 不改动 `agents/` 下任何 reviewer agent（无 GitNexus 直接依赖）
- 不改动 `src/cli/helpers/` 中其他辅助模块（非 gitnexus 相关）
- 不引入新的图谱能力抽象或替代方案（本次只做移除，不做替换）
- 不删除 `.spec-first/graph/` 目录结构本身（只删除其中由 GitNexus 生成的具体文件）

### Deferred to Follow-Up Work

- `spec-first doctor` 输出是否需要调整 GitNexus 状态展示：独立小任务
- 若未来引入其他 graph provider，可参考已清理后的 provider-agnostic 抽象骨架重新建设

---

## Graph Readiness

- target_repo: spec-first
- status: unavailable
- source_revision: N/A
- current_revision: N/A
- stale: N/A
- primary_providers: none
- degraded_providers: none
- fallback_capabilities: bounded direct repo reads
- runtime_mcp_evidence: unavailable
- confidence: not-applicable
- limitations: 本计划的目标正是移除 graph readiness 基础设施，不适用图谱证据

---

## Context & Research

### 涉及文件规模（来自会话分析）

| 类别 | 规模 |
|------|------|
| 整删 JS 核心模块 | 2 文件（`gitnexus-instruction-block.js` 409 行、`compile-workspace-gitnexus-readiness.js` 664 行） |
| 整删 skill | `skills/spec-graph-bootstrap/`（12 文件，约 10k 行） |
| 整删 review-pre-facts | `src/cli/helpers/review-pre-facts/`（14 JS 文件，3128 行） |
| 整删单测 | 4 个 unit test 文件 |
| 整删契约文档 | 6 个（gitnexus-capability-catalog、workspace-gitnexus-consumption、downstream-graph-evidence-consumption、graph-evidence-policy、graph-provider-consumption、workflows/review-pre-facts-extraction） |
| 修改 CLI 命令 | `init.js`（2280 行）、`clean.js`、`internal.js` |
| 修改辅助模块 | `scenario-fingerprint.js`（982 行，31 处 gitnexus 引用） |
| 修改 skill prose | 7 个 SKILL.md（spec-plan 8 处、spec-code-review 10 处、spec-doc-review 6 处、spec-work 7 处、spec-debug 4 处、using-spec-first 5 处、spec-write-tasks 2 处） |
| 清理历史文档 | docs/brainstorms/ 21 个文件，docs/plans/ 63 个文件 |

### 关键函数和调用链

- `init.js:2040` → `normalizeGitNexusInstructionBlock(finalInstruction, { createMissing: true, ... })` — 无条件注入入口
- `internal.js:4,22` — `workspace-gitnexus-readiness` 命令注册
- `scenario-fingerprint.js` — `extractGitNexusStatus()`、`buildBootstrapGitNexusRef()`、`providerIsDegraded()`、`providerStatusRef()` 四个函数需删除
- `src/cli/helpers/review-pre-facts/readiness.js:19` — `providers.find(p => p.provider === 'gitnexus')` 硬编码

### 保持不动的部分

- `src/cli/helpers/scenario-fingerprint.js` 中的 provider-agnostic 路由骨架（仅删 gitnexus 专属函数）
- `Graph Readiness` 块结构（保留 `providers_status_refs: {}` 空对象兼容现有消费者）
- runtime artifacts 结构（`.spec-first/graph/` 目录本身可继续存在，只删已生成文件）

---

## Key Technical Decisions

- **整删 review-pre-facts 而非保留**：该模块设计目的是 GitNexus 证据规范化消费层，其 fixtures 全部为 provider/graph-facts 数据结构。移除 GitNexus 后无数据源，保留无意义。（source_tag: user-decision）

- **直读模式作为 skill 的唯一上下文路径**：各 skill SKILL.md 中的 `fallback 到 grep/Read` 提升为唯一路径，去掉"优先 GitNexus，fallback 到直读"的两段式姿态。（source_tag: user-decision）

- **历史文档批量替换而非删除**：docs/brainstorms/ 和 docs/plans/ 是历史档案，有完整性价值。只清理其中的 gitnexus 引用段落，文件本身保留。（source_tag: user-decision）

- **`providers_status_refs: {}` 保留空对象**：删除 gitnexus 字段后，scenario fingerprint 中的 `providers_status_refs` 保留空对象，兼容可能读取该字段但做 null check 的下游消费者。（source_tag: advisory）

- **`providerQueryDegraded` 固定为 `false`**：移除 gitnexus 后，scenario fingerprint 的 `providerQueryDegraded` 计算由 `extractGitNexusStatus()` 驱动，移除后无 provider 可降级，直接改为常量 `false`，`provider-degraded` scenario class 永远不触达。（source_tag: advisory）

---

## Open Questions

### Resolved During Planning

- **review-pre-facts 要整删还是保留**：整删。唯一消费者是 GitNexus 证据流，无其他独立用途。（user-decision）
- **历史文档要删文件还是清引用**：清引用，保留文件。（user-decision）
- **`scenario-fingerprint.js` 的 `provider-degraded` scenario class 是否要同步删除**：不删。该 class 枚举仍有描述意义，只是永远不会被触发。（advisory）

### Deferred to Implementation

- `spec-first doctor` 命令是否会因 GitNexus 相关状态检查报错：执行期间运行 `spec-first doctor --claude` 观察实际输出，必要时修正
- 7 个 SKILL.md 的具体段落边界：各 skill 文件较长，精确删除边界需执行期读取确认，不宜在计划层固定

---

## Implementation Units

### U1. 整删纯 GitNexus 专属文件和 runtime artifacts

**Goal:** 删除所有以 GitNexus 为主体的文件——无外部 require 依赖的独立删除，是后续所有单元的前提。

**Requirements:** R1, R2, R3, R7

**Dependencies:** 无

**Files:**
- Delete: `src/cli/gitnexus-instruction-block.js`
- Delete: `src/cli/helpers/compile-workspace-gitnexus-readiness.js`
- Delete: `skills/spec-graph-bootstrap/`（整目录）
- Delete: `docs/contracts/gitnexus-capability-catalog.md`
- Delete: `docs/contracts/workspace-gitnexus-consumption.md`
- Delete: `docs/contracts/downstream-graph-evidence-consumption.md`
- Delete: `docs/contracts/graph-evidence-policy.md`
- Delete: `docs/contracts/graph-provider-consumption.md`
- Delete: `docs/contracts/workflows/review-pre-facts-extraction.md`
- Delete: `tests/unit/gitnexus-instruction-block.test.js`
- Delete: `tests/unit/workspace-gitnexus-readiness.test.js`
- Delete: `tests/unit/workspace-gitnexus-contracts.test.js`
- Delete: `tests/unit/gitnexus-capability-catalog-contracts.test.js`
- Delete: `tests/fixtures/review-pre-facts/providers/`（整目录，3 个 gitnexus fixture）
- Delete（runtime artifacts）: `.spec-first/graph/graph-facts.json`、`.spec-first/graph/provider-status.json`、`.spec-first/graph/bootstrap-report.md`、`.spec-first/providers/gitnexus/`（若存在）

**Approach:**
- 所有删除均为纯文件系统操作，无代码引用方向的修改
- runtime artifacts 删除防止残留的已生成文件在后续 doctor/init 时触发不一致

**Patterns to follow:**
- 无特殊模式，直接 `rm -rf` / `rm -f`

**Test scenarios:**
- Test expectation: none — 纯删除，验证 via U8 残留引用扫描

**Verification:**
- `ls` 确认上述路径均不存在
- `grep -rn "gitnexus" src/cli/gitnexus-instruction-block.js` 报 No such file

---

### U2. 修改 CLI 命令（init.js、clean.js、internal.js）

**Goal:** 解除 init 的 GitNexus 指令块注入，移除 clean 的 `.gitnexus` 清理逻辑，移除 internal 的 `workspace-gitnexus-readiness` 命令注册。

**Requirements:** R4, R1

**Dependencies:** U1（被 require 的模块在 U1 已删）

**Files:**
- Modify: `src/cli/commands/init.js`
- Modify: `src/cli/commands/clean.js`
- Modify: `src/cli/commands/internal.js`

**Approach:**

`init.js` 三处修改：
1. 删除 `require('../gitnexus-instruction-block')` 行（约 52 行）
2. 从 skipNames Set 删除 `'.gitnexus'` 条目（约 1540 行）
3. 将 `normalizeGitNexusInstructionBlock(finalInstruction, {...}).content` 调用替换为直接使用 `finalInstruction`，并删除对应的 `operations.push` 改用 `finalInstruction`（约 2040-2051 行）

`clean.js` 一处修改：
- 从 `isAllowedWorkspaceOrphanPath()` 函数删除 `.gitnexus`、`.spec-first/providers/gitnexus`、`.spec-first/providers/gitnexus/` 前缀、`.spec-first/config/graph-providers.json` 四个条件

`internal.js` 两处修改：
1. 删除 `require('../helpers/compile-workspace-gitnexus-readiness')` 行
2. 删除 `require('../helpers/review-pre-facts')` 行（review-pre-facts 在 U4 删除）
3. 删除 `workspace-gitnexus-readiness` 和 `review-pre-facts` 两个 if 分支

**Patterns to follow:**
- 参考 `src/cli/commands/init.js` 现有的 `applyManagedBlock` / `applyManagedBootstrapBlock` 调用链，`finalInstruction` 是倒数第二步的产物，直接传给 `buildPlanFileOperation` 即可

**Test scenarios:**
- Happy path: 修改后 `node --check src/cli/commands/init.js` 无语法错误
- Happy path: 修改后 `node --check src/cli/commands/clean.js` 无语法错误
- Happy path: 修改后 `node --check src/cli/commands/internal.js` 无语法错误
- Integration: `spec-first init` 执行成功且不在 CLAUDE.md/AGENTS.md 中写入 gitnexus block（U8 验证）

**Verification:**
- 三个文件通过 `node --check` 语法检查
- `grep -n "gitnexus\|GitNexus\|normalizeGitNexus\|review-pre-facts" src/cli/commands/init.js src/cli/commands/clean.js src/cli/commands/internal.js` 无输出

---

### U3. 修改 scenario-fingerprint.js（移除 31 处 gitnexus 引用）

**Goal:** 从 scenario-fingerprint.js 移除所有 GitNexus 专属函数和计算逻辑，同时保持指纹结构的 schema 兼容性。

**Requirements:** R1

**Dependencies:** 无（独立文件，不 require 已删模块）

**Files:**
- Modify: `src/cli/helpers/scenario-fingerprint.js`

**Approach:**

删除项：
- `REPO_LOCAL_ARTIFACT_PATHS` 数组：移除 `.spec-first/providers/gitnexus/status.json` 和 `.gitnexus/meta.json`
- `extractGitNexusStatus()` 函数（约 783-793 行）
- `buildBootstrapGitNexusRef()` 函数（约 795-807 行）
- `providerIsDegraded()` 函数（约 414-425 行）
- `providerStatusRef()` 函数（约 427-449 行）

修改项：
- `computeSetupLayer()`：`const providerQueryDegraded = providerIsDegraded(targetFacts)` → `const providerQueryDegraded = false`
- `computeSetupLayer()` 返回对象：`providers_status_refs: { gitnexus: providerStatusRef(targetFacts) }` → `providers_status_refs: {}`
- `computeBootstrapLayer()`：删除 `gitnexusStatus` 变量声明及其参与的 `currentRevision` 备用源
- `computeBootstrapLayer()`：删除 `hasGitNexusStatus`、`gitnexusQueryReady`，`providerQueryDegraded = false`
- `computeBootstrapLayer()` 返回对象：`providers_status_refs: { ...setupRefs, gitnexus: buildBootstrapGitNexusRef({...}) }` → `providers_status_refs: { ...setupRefs }`
- `computeBootstrapLayer()` `generated_from.provider_status`：固定为 `null`（文件已删）
- `hasParentRepoLocalArtifacts()`：移除 `'.gitnexus'`
- `hasPriorSpecFirstArtifacts()`：移除 `.spec-first/providers/gitnexus/status.json` 和 `.spec-first/config/graph-providers.json`
- `buildLimitations()`：将 `'...GitNexus indexing is not implied'` 改为通用措辞

**Patterns to follow:**
- 文件现有的 CommonJS 风格和 2 空格缩进
- 保持 `provider-degraded` 在 `PROVISIONAL_SCENARIO_CLASSES` 枚举（不删，只是永不触达）

**Test scenarios:**
- Happy path: `node --check src/cli/helpers/scenario-fingerprint.js` 无语法错误
- Happy path: `grep -n "gitnexus\|GitNexus" src/cli/helpers/scenario-fingerprint.js` 无输出
- Edge case: `providers_status_refs` 字段在 setup 层输出仍存在（值为 `{}`），消费者不崩溃

**Verification:**
- 文件通过 `node --check`
- 无 gitnexus 残留引用
- `npm run test:unit` 中 `scenario-fingerprint` 相关测试通过（若有）

---

### U4. 删除 review-pre-facts 模块及相关契约文档

**Goal:** 删除 GitNexus 证据消费层的全部文件（JS 模块、测试 fixtures、契约文档）。

**Requirements:** R3, R6

**Dependencies:** U1（part of the same deletion wave；U2 已在 internal.js 移除 require）

**Files:**
- Delete: `src/cli/helpers/review-pre-facts/`（整目录 14 文件）
- Delete: `tests/fixtures/review-pre-facts/`（剩余 fixture 文件，约 14 个）

注：`docs/contracts/` 下的相关契约文档在 U1 已删，无需重复。

**Approach:**
- `rm -rf src/cli/helpers/review-pre-facts/ tests/fixtures/review-pre-facts/`
- U2 已在 `internal.js` 移除 `require('../helpers/review-pre-facts')` 和对应的 `if` 分支，删除模块目录后不会有悬空 require

**Test scenarios:**
- Test expectation: none — 纯删除，验证 via U8 残留扫描

**Verification:**
- `ls src/cli/helpers/review-pre-facts` → 路径不存在
- `ls tests/fixtures/review-pre-facts` → 路径不存在

---

### U5. 修改 7 个 skill SKILL.md

**Goal:** 从 7 个核心 workflow skill 的 SKILL.md 中删除所有 GitNexus 和 review-pre-facts 引用段落，保留 grep/Read 直读作为唯一上下文路径。

**Requirements:** R5, R6

**Dependencies:** U1（spec-graph-bootstrap 已删，prose 引用才合理删除）、U4（review-pre-facts 已删）

**Files:**
- Modify: `skills/spec-write-tasks/SKILL.md`（2 处，低难度）
- Modify: `skills/spec-work/SKILL.md`（7 处，中难度）
- Modify: `skills/spec-debug/SKILL.md`（4 处，中难度）
- Modify: `skills/using-spec-first/SKILL.md`（5 处，中难度）
- Modify: `skills/spec-plan/SKILL.md`（8 处，高难度）
- Modify: `skills/spec-doc-review/SKILL.md`（6 处，高难度）
- Modify: `skills/spec-code-review/SKILL.md`（10 处，高难度）

**Approach:**

删除原则：**删除 GitNexus/review-pre-facts 引用段落，保留 grep/Read 直读路径作为唯一上下文路径**。具体操作：

**spec-write-tasks**（低难度）：
- 删除 `review-pre-facts-extraction.md` 和 `src/cli/helpers/review-pre-facts/` 的引用子句
- 删除 `## Graph / GitNexus Evidence` 块消费段落

**spec-work**（中难度）：
- Context Orientation Anchor：删除"When graph readiness artifacts are degraded...prefer live GitNexus MCP evidence..."段落，保留直读路径
- 删除 `review-pre-facts` 引用子句
- 删除 `## Graph Freshness / Refresh Trigger Boundary` 整节
- 简化 Workspace Repo Scope 节，删除 GitNexus-first evidence 和 workspace-gitnexus-readiness 逻辑
- 删除 `## Graph / GitNexus Evidence` 块消费段落（含三条 bullet）

**spec-debug**（中难度）：
- Context Orientation Anchor：简化 parent workspace 段落，删除 GitNexus-first 查询逻辑
- 删除 `## Graph Freshness / Refresh Trigger Boundary` 整节（含 pre-facts helper 段）
- 删除 hypothesis ledger 中 `graph_evidence` 可选字段说明
- 删除 causal chain gate 中 `graph_evidence` 相关验证要求

**using-spec-first**（中难度）：
- 兼容规则段：移除 `.gitnexus/**` 从旧图谱工件检测
- 删除场景优先级检查第 4 条（`providers_status_refs.gitnexus.query_ready`）
- 路由表：删除 `compile or refresh GitNexus graph readiness...` 一行
- 删除 `### Graph Refresh Routing Boundary` 整节
- 删除 `### Parent Workspace Graph Evidence` 整节
- Codex 启动提醒段：删除 GitNexus graph snapshot 相关句子

**spec-plan**（高难度）：
- Phase 1.1a 中删除 setup projection gitnexus 相关检查
- Phase 1.1a.1 整节描述中删除 gitnexus 专属姿态探测逻辑
- workspace graph 规划中删除 gitnexus-readiness.json 读取段
- 删除 `review-pre-facts` 信任模型引用

**spec-doc-review**（高难度）：
- 删除 Phase 1b 完整预事实提取阶段（review-pre-facts 命令序列 5 步）
- 删除图表新鲜度检查段和 spec-graph-bootstrap 推荐段

**spec-code-review**（高难度）：
- 删除 Stage 3b 预事实提取（native capability routing）段
- 删除多仓库 GitNexus 证据聚合段
- 删除 Degraded-once rule（GitNexus startup fails）段
- 删除 `## Graph / GitNexus Evidence` 块消费段

**Execution note:** 每个 SKILL.md 修改前读取全文确认边界，避免误删相邻语义段落。prose 变更需 fresh-source eval 验证语义正确性（见 `docs/contracts/workflows/fresh-source-eval-checklist.md`）。

**Patterns to follow:**
- `docs/contracts/context-governance.md` Host Instruction Reuse Policy 的表述模式（保留的段落风格）
- 修改后的句式应与 skill 原有段落风格一致，不引入新抽象

**Test scenarios:**
- Happy path: 每个修改后的 SKILL.md `grep -n "gitnexus\|GitNexus\|review-pre-facts\|spec-graph-bootstrap" <file>` 无输出
- Edge case: using-spec-first 路由表中 `spec:graph-bootstrap` 行删除后，无孤儿路由条目
- Edge case: spec-plan 删除 gitnexus 相关逻辑后，Phase 1.1a 的 graph readiness 路径仍完整（仅描述"无图谱 provider 时直接 fallback"）

**Verification:**
- 7 个文件均无 gitnexus/GitNexus/review-pre-facts/spec-graph-bootstrap 残留（可接受：仅在历史引用段落中用于说明"已移除"的记录性提及）

---

### U6. 修改 package.json + CLAUDE.md + AGENTS.md + 重生成 runtime

**Goal:** 从 package.json 的 files 白名单删除已删契约文档；从 CLAUDE.md/AGENTS.md 删除 `<!-- gitnexus:start/end -->` managed block；重生成 host runtime 确保 `.claude/` 和 `.codex/` 同步。

**Requirements:** R4, R8

**Dependencies:** U1（契约文档已删）

**Files:**
- Modify: `package.json`
- Modify: `CLAUDE.md`
- Modify: `AGENTS.md`

**Approach:**

`package.json` 的 `"files"` 数组删除：
```
"docs/contracts/gitnexus-capability-catalog.md"
"docs/contracts/graph-evidence-policy.md"
"docs/contracts/graph-provider-consumption.md"
"docs/contracts/workspace-gitnexus-consumption.md"
```

`CLAUDE.md` 和 `AGENTS.md` 删除 managed block：
```
<!-- gitnexus:start -->
# GitNexus — Code Intelligence
...
<!-- gitnexus:end -->
```

重生成 runtime（CLI 操作，不手改 generated runtime assets）：
```bash
spec-first init
spec-first doctor --claude
```

**Test scenarios:**
- Happy path: `grep "gitnexus" CLAUDE.md AGENTS.md` 无输出
- Happy path: `grep "gitnexus-capability-catalog\|workspace-gitnexus-consumption\|graph-evidence-policy\|graph-provider-consumption" package.json` 无输出
- Integration: `spec-first init` 执行成功，生成的 `.claude/CLAUDE.md` 不含 gitnexus block
- Integration: `spec-first doctor --claude` 通过，无因 gitnexus 相关缺失而报错

**Verification:**
- CLAUDE.md/AGENTS.md 无 gitnexus managed block
- `spec-first doctor --claude` 退出码 0

---

### U7. 清理历史文档（docs/brainstorms/ + docs/plans/）

**Goal:** 批量清理历史文档中的 gitnexus 引用段落，保留文件，不破坏历史记录完整性。

**Requirements:** R9

**Dependencies:** 无（独立操作，不影响其他单元）

**Files:**
- Modify: `docs/brainstorms/`（21 个含 gitnexus 引用的文件）
- Modify: `docs/plans/`（63 个含 gitnexus 引用的文件）

**Approach:**

分两类处理：

1. **`## Graph / GitNexus Evidence` 整节**（出现在 plan 文档中）：删除该节全部内容
2. **行内 gitnexus 文字引用**：
   - `$spec-graph-bootstrap` / `/spec:graph-bootstrap` 命令引用：替换为 `（已移除：spec:graph-bootstrap）`
   - `GitNexus`、`gitnexus` 文字：按上下文处理——纯叙述可保留作历史记录，指令性/可操作性引用（如"使用 GitNexus 作为首选工具"）改为注释或删除

优先处理 docs/plans 中含实操指令的文件（通常标记为 `status: active` 或 `status: partially-shipped`）。纯叙事 brainstorm 文件可批量 sed 替换。

**Test scenarios:**
- Test expectation: none — 历史档案修改，无行为影响；残留的记录性提及（如"当时使用了 GitNexus"）是预期保留的

**Verification:**
- `grep -rn "$spec-graph-bootstrap\|/spec:graph-bootstrap" docs/brainstorms/ docs/plans/` 无"可操作性"引用（记录性提及可接受）

---

### U8. CHANGELOG 更新 + 全面验证

**Goal:** 记录本次 breaking change；运行完整验证链确认仓库在移除后保持可用状态。

**Requirements:** R10, R11

**Dependencies:** U1, U2, U3, U4, U5, U6, U7

**Files:**
- Modify: `CHANGELOG.md`

**Approach:**

CHANGELOG 新增条目（user-visible breaking change）：

```
### Changed
- **BREAKING**: 移除 GitNexus 图谱 provider 集成
  - `spec:graph-bootstrap` workflow 和命令已移除
  - `spec-first init` 不再向宿主注入 GitNexus 指令块
  - review-pre-facts 证据消费层已移除
  - 各 workflow 上下文证据回退为 grep/Read 直读模式
```

验证链：
```bash
# 1. 无残留引用（src/、skills/、agents/、templates/、tests/ 范围）
grep -rn "gitnexus\|GitNexus\|graph-facts\|review-pre-facts\|spec-graph-bootstrap" \
  src/ skills/ agents/ templates/ tests/ \
  --include="*.js" --include="*.md" --include="*.json" --include="*.sh"

# 2. 语法检查
npm run typecheck

# 3. 单测（gitnexus 测试已删，其余应通过）
npm run test:unit

# 4. smoke 通过
npm run test:smoke

# 5. CLAUDE.md/AGENTS.md 无 gitnexus block
grep -n "gitnexus" CLAUDE.md AGENTS.md

# 6. runtime 重生成干净
spec-first init
spec-first doctor --claude
```

**Test scenarios:**
- Happy path: 残留扫描命令返回空（`echo $?` 为 0 表示 grep 无匹配）
- Happy path: `npm run typecheck` 退出码 0
- Happy path: `npm run test:unit` 退出码 0（删除的测试文件不计入通过，其余保持）
- Happy path: `npm run test:smoke` 退出码 0
- Integration: `spec-first init` + `spec-first doctor --claude` 均退出码 0

**Verification:**
- 所有 5 个验证命令退出码 0
- CHANGELOG.md 包含 breaking change 条目

---

## System-Wide Impact

- **双宿主生成**：CLAUDE.md/AGENTS.md 修改后需重新生成 `.claude/` 和 `.codex/` runtime，通过 `spec-first init` 完成
- **`spec:graph-bootstrap` 命令消失**：用户依赖该命令的文档、脚本、CI 配置需要手工清理（scope 外，deferred）
- **`workspace-gitnexus-readiness.v1` advisory artifact 失效**：using-spec-first skill 的 parent workspace 路由中引用该 artifact，U5 已清理 prose，但已有仓库若存有该文件的内容不影响运行
- **scenario fingerprint `provider-degraded` class 永不触达**：不是 bug，而是预期状态；若将来新 provider 接入，该 class 可自然复用

---

## Risks & Dependencies

| 风险 | 缓解 |
|------|------|
| scenario-fingerprint.js 修改后 provider_query_degraded 硬编码为 false 改变了某些测试 fixture 中的 state_class 预期 | U8 验证中 `npm run test:unit` 会暴露，届时修正 fixture |
| spec-plan SKILL.md Phase 1.1a 删除 gitnexus 部分后，graph readiness 路径叙述不完整 | U5 执行时完整读取 Phase 1.1a 内容，确保仅删 gitnexus 专属段落，保留通用图谱状态读取结构 |
| CLAUDE.md 的 managed block 删除后 `spec-first init` 重新注入（若 source 未同步） | U2 已在 init.js 移除注入逻辑，源先于 runtime 修改 |
| 历史文档批量替换误改正文叙述内容 | 替换策略保守：只改"可操作性"引用，不改"叙述性"历史内容；可 `git diff` 逐文件 review |

---

## Documentation / Operational Notes

- 完成后更新 `README.md` 和 `README.zh-CN.md`：移除 spec-graph-bootstrap 使用说明和 GitNexus 配置指引（scope 外，可在独立 PR 处理）
- 若团队有外部 wiki 或 onboarding 文档引用 `spec:graph-bootstrap`，需同步清理

---

## Sources & References

- 分析会话 transcript: `2026-06-02-150315-spec-firstgitnexus.txt`（仓库根目录）
- 初步方案文档: `.claude/plans/wiggly-stargazing-tide.md`
- 角色契约: `docs/10-prompt/结构化项目角色契约.md`
- fresh-source eval checklist: `docs/contracts/workflows/fresh-source-eval-checklist.md`
