---
title: "refactor: 收窄 runtime tooling 边界，避免污染 brainstorm"
type: refactor
status: active
date: 2026-04-28
spec_id: 2026-04-28-005-runtime-tool-boundary
---

# refactor: 收窄 runtime tooling 边界，避免污染 brainstorm

## 概览

收窄 `CLAUDE.md` / `AGENTS.md` 中 runtime tools managed block 的全局语义，让 `GitNexus`、`code-review-graph` 和 graph readiness 只在工程执行阶段作为可选证据增强，而不是污染 `spec-brainstorm`、需求澄清、产品定义和非代码文档写作。

本计划保留 graph compiler、GitNexus、external `code-review-graph` 和 `.spec-first/graph/*` / `.spec-first/impact/*` readiness artifacts。改动重点是 prompt governance：root instruction file 是工具索引，skill 是阶段边界所有者，graph artifacts 是工程执行证据。

---

## 问题框架

当前 [src/cli/runtime-tools-index.js](src/cli/runtime-tools-index.js) 生成的 runtime tools block 会写入 `CLAUDE.md` / `AGENTS.md`。其中 GitNexus 文案写成“若本文件存在 `<!-- gitnexus:start -->` 管理块，优先遵守该块的强制规则”，`code-review-graph` 文案也会在 blocked / stale / 未 ready 时提示先运行 graph-bootstrap。

这个提示对代码编辑、影响分析、代码审查和提交前检查是有用的，但它被放在 root instruction file 后，会被上游 workflow 一起读到。`spec-brainstorm` Phase 1.1 会扫描 `AGENTS.md` / `CLAUDE.md` 的 workflow、product、scope constraints；如果没有明确过滤 runtime tooling，就可能把 graph / GitNexus / CRG 的工程执行规则误读成 brainstorm 阶段必须遵守的全局行为。

这违背 `docs/10-prompt/项目角色.md` 的基线：脚本准备确定性事实，LLM 做语义判断；graph readiness 是输入质量增强，不是全局状态机或需求阶段 gate。

---

## 需求追踪

- R1. `CLAUDE.md` / `AGENTS.md` 仍然列出 `GitNexus`、`code-review-graph`、`Serena MCP`、`ast-grep` 的用途和降级边界。
- R2. Runtime tools block 必须明确适用范围：代码库咨询、实现计划、代码修改、代码审查、提交前检查等工程执行场景。
- R3. Runtime tools block 必须明确 brainstorm、需求澄清、产品定义、用户故事整理、非代码文档写作不会因为本节存在而自动触发 GitNexus、CRG、graph-bootstrap 或 impact analysis。
- R4. GitNexus 外部 `<!-- gitnexus:start -->` block 的 MUST 规则只在代码编辑、影响分析、提交前检查、代码审查场景升级为必须遵守。
- R5. `code-review-graph` 仍是变更影响、review context、相关测试和 graph stats provider，不进入通用咨询/搜索降级链路，也不在 brainstorm 阶段触发 graph-bootstrap。
- R6. `spec-brainstorm` 读取 instruction files 时必须主动过滤 runtime tool-routing blocks、graph readiness rules、GitNexus / code-review-graph mandatory edit rules、MCP readiness notes 和 impact-analysis requirements。
- R7. `spec-plan` 继续把 graph readiness 当 optional bounded evidence，不把 runtime tool guidance 当产品范围、用户需求或强制 tool setup 工作。
- R8. 当前仓库提交的 `AGENTS.md` / `CLAUDE.md` 必须同步到新模板；不得手改 `.agents/skills/`、`.claude/`、`.codex/` 运行时镜像。
- R9. 测试必须锁住“不要污染 brainstorm / doc-only workflows”的语义，防止未来 managed block 回退成全局 prompt 污染源。
- R10. 本次源码和文档变更必须按项目规则更新 `CHANGELOG.md`。

---

## 范围边界

- 不删除 graph compiler。
- 不删除 `.spec-first/graph/*` 或 `.spec-first/impact/*` artifacts。
- 不删除 GitNexus 或 external `code-review-graph` 能力。
- 不改变 `spec-graph-bootstrap` 主契约、provider command safety 或 canonical artifact 输出。
- 不改变 `spec-first init` 写入 managed block 的机制；只改 block 内容和消费方边界。
- 不把 `spec-plan` 扩展成工具安装 / graph-bootstrap 工作流。
- 不手工修改 `.agents/skills/`、`.claude/`、`.codex/` 下的 generated/runtime mirrors。
- 不把 plan 阶段变成 implementation；实际代码修改由后续 `$spec-work` 执行。

---

## Graph Readiness

- status: stale
- source_revision: 5d191758552cc10962e93131254a79391092982f
- current_revision: 40fe1c0749e624cbe2e57146bd1e295a1ca05c44
- stale: true
- primary_providers: code-review-graph, gitnexus
- degraded_providers: none recorded
- fallback_capabilities: bounded direct repo reads, Serena MCP / ast-grep where useful
- confidence: medium
- limitations: `.spec-first/graph/graph-facts.json` 存在并报告 primary readiness，但它由旧 source revision 生成。当前计划只把 graph facts 当作 stale supporting evidence，不当作当前 primary evidence。

---

## 上下文与调研

### 相关代码与模式

- [src/cli/runtime-tools-index.js](src/cli/runtime-tools-index.js)：`spec-first:runtime-tools` managed block 的 source of truth。当前已经支持 host-specific entry、中英文正文、drift inspection、clean 移除，以及插入到外部 GitNexus block 之前。
- [src/cli/commands/init.js](src/cli/commands/init.js)：`buildInitMetadataPlan()` 依次应用 language、bootstrap、coding guidelines、runtime tools；这个写入机制可以保持不变。
- [src/cli/commands/doctor.js](src/cli/commands/doctor.js)：通过 `inspectRuntimeToolsIndexBlock()` 检查 runtime tools drift。
- [src/cli/commands/clean.js](src/cli/commands/clean.js)：移除 managed runtime tools block，同时保留外部 GitNexus 内容。
- [tests/unit/runtime-tools-index.test.js](tests/unit/runtime-tools-index.test.js)：当前 contract tests 断言了“优先遵守该块的强制规则”等旧文案，必须同步更新。
- [skills/spec-brainstorm/SKILL.md](skills/spec-brainstorm/SKILL.md)：Phase 1.1 当前会读取 instruction files 中的 workflow / product / scope constraints，但没有过滤 runtime tooling。
- [skills/spec-plan/SKILL.md](skills/spec-plan/SKILL.md)：已经有 `Graph Readiness Facts (Optional, Bounded)`，并明确 graph readiness 是 evidence context，不是 planning gate。
- [AGENTS.md](AGENTS.md) 和 [CLAUDE.md](CLAUDE.md)：当前提交的 root instruction files 包含旧 runtime tools block 和外部 GitNexus block。

### 机构知识沉淀

- [docs/solutions/workflow-issues/modify-source-not-artifacts-2026-04-13.md](docs/solutions/workflow-issues/modify-source-not-artifacts-2026-04-13.md)：持久改动必须落在 source-of-truth 文件，而不是 generated runtime artifacts。这直接适用于 `src/cli/runtime-tools-index.js` 与 `.agents/skills/*` / `.claude/*` 的边界。
- [docs/solutions/workflow-issues/database-routing-and-dual-view-refresh-boundaries-2026-04-20.md](docs/solutions/workflow-issues/database-routing-and-dual-view-refresh-boundaries-2026-04-20.md)：readiness facts 与 downstream semantic use 要分离。这支持把 graph readiness 当 evidence，而不是 gate。
- [docs/solutions/architecture-patterns/workflow-entrypoint-exposure-contract-2026-04-26.md](docs/solutions/architecture-patterns/workflow-entrypoint-exposure-contract-2026-04-26.md)：dual-host surfaces 运行时形态不同，因此测试必须同时守住 Claude `/spec:*` 和 Codex `$spec-*` 的语义一致性。

### 影响面说明

虽然 graph facts 已 stale，但本轮仍运行了 GitNexus impact analysis 作为辅助证据：

- `buildRuntimeToolsBlock` upstream impact: HIGH；直接调用方包括 runtime-tools tests、`writeRuntimeToolsIndexBlock`、`inspectRuntimeToolsIndexBlock` 和 `buildInitMetadataPlan`。
- `buildZhRuntimeToolsBody` upstream impact: CRITICAL；body 文案变化会影响 build、inspect、clean stale-body stripping、init write plans 和 runtime-tools tests。

实施前应重新运行 fresh impact analysis，再保持 patch 边界尽量窄。

### 外部参考

不需要外部 web research。本任务是仓库内 workflow governance 与 prompt boundary 调整。

---

## 关键技术决策

- Root instruction files 保持为工具索引，不变成 workflow policy engine。`runtime-tools-index.js` 应说明工具何时可用、用于什么场景；是否 relevant 由 skill-level phase boundaries 决定。
- `spec-brainstorm` 增加明确的消费过滤器。修复 source block 能移除当前污染源；brainstorm filter 能防止未来其他 root instruction block 再引入同类问题。
- `spec-plan` 继续把 graph readiness 当 optional evidence。它不应把 runtime guidance 转成产品范围、用户需求或 tool setup tasks。
- 外部 GitNexus block 仍保持外部归属。新的 managed block 只收窄 GitNexus MUST rules 的适用场景，不编辑、不接管 `<!-- gitnexus:start -->`。
- 测试应断言语义 guardrails，而不是完整 prose snapshot。使用定向 substring 覆盖 scope、exclusions 和 host-specific entries。

---

## 开放问题

### 规划中已解决

- 是否要删除 graph compiler 或 graph artifacts？不需要。问题在 prompt governance scope，不在 provider 存在本身。
- 是否要重设计 `init.js`？不需要。写入顺序没有问题，只需要收紧 generated block prose。
- 是否要修改 `spec-graph-bootstrap`？不需要。它当前 contract 已经说明脚本准备 deterministic readiness facts，downstream workflows 决定 relevance。
- 是否要手工同步 root `AGENTS.md` / `CLAUDE.md`？需要，因为它们在当前仓库中被提交，且仍包含旧文案。只同步 managed runtime tools block，不编辑 generated runtime mirrors。

### 延后到实现阶段

- 英文 block 的具体措辞可在实现阶段微调，但必须与中文 block 保持语义一致，并包含 “must not automatically trigger”、“brainstorm”、“code editing”、“impact analysis” 和 “code review”。
- 创建 `tests/unit/spec-brainstorm-contracts.test.js` 还是合并到现有 skill contract test，可由实现时按本地测试组织决定。当前仓库没有专门的 brainstorm contract test，因此新增一个 focused file 最简单。

---

## 实施单元

- U1. **收窄 runtime tools managed block**

**目标：** 修改 source template，让新生成的 `AGENTS.md` / `CLAUDE.md` 把 runtime tools 表达为工程执行阶段的 evidence routing，而不是全局 workflow mandate。

**需求：** R1, R2, R3, R4, R5

**依赖：** 无

**文件：**
- 修改：`src/cli/runtime-tools-index.js`
- 测试：`tests/unit/runtime-tools-index.test.js`

**方法：**
- 在每个工具的使用边界之前新增 `### 适用范围` / `### Applicability` section。
- 将 GitNexus 外部 block MUST rules 收窄到代码编辑、影响分析、提交前检查和代码审查。
- 将 `code-review-graph` readiness checks 收窄到需要 graph evidence 的 plan / implementation / review 阶段。
- 明确 brainstorm、requirements clarification、product definition、user stories 和 non-code docs 不会自动触发 GitNexus、CRG、graph-bootstrap 或 impact analysis。
- 同一个 patch 内同步更新 `buildZhRuntimeToolsBody()` 和 `buildEnRuntimeToolsBody()`。
- 保留 `/spec:graph-bootstrap` 与 `$spec-graph-bootstrap` 的 host-specific `graphBootstrapEntry` 插值。

**遵循模式：**
- `buildZhRuntimeToolsBody()` 和 `buildEnRuntimeToolsBody()` 现有 body construction。
- `runtimeToolsReferencePath(host)` 现有 host-specific path 处理。

**测试场景：**
- 正常路径：Codex 中文 block 包含 `### 适用范围`、`需求澄清`、`brainstorm`、`不应因为本节存在而自动触发` 和 `$spec-graph-bootstrap`。
- 正常路径：Claude 中文 block 包含 `/spec:graph-bootstrap` 且不包含 `$spec-graph-bootstrap`。
- 正常路径：GitNexus 文案包含 `仅在代码编辑、影响分析、提交前检查、代码审查场景遵守其中 MUST 规则`。
- 错误路径：中文 block 不再包含旧的未收窄文案 `优先遵守该块的强制规则`。
- 正常路径：英文 block 包含 `must not automatically trigger`、`brainstorm`、`code editing`、`impact analysis`、`pre-commit checks` 和 `code review`。
- 错误路径：英文 block 不再包含未收窄的 `follow that block's mandatory rules first`。
- 回归：现有负向断言继续通过，确保不包含 install commands、dynamic ready state 和 symbol counts。

**验证：**
- `tests/unit/runtime-tools-index.test.js` 证明 host-specific entries 和 scoped mandatory tooling behavior 同时正确。

---

- U2. **为 brainstorm 增加 runtime tooling filter**

**目标：** 防止 `spec-brainstorm` 在扫描 instruction files 时吸收 runtime tooling 或 graph readiness rules。

**需求：** R6

**依赖：** U1

**文件：**
- 修改：`skills/spec-brainstorm/SKILL.md`
- 新增：`tests/unit/spec-brainstorm-contracts.test.js`

**方法：**
- 在 `#### 1.1 Existing Context Scan` 下、`Constraint Check` 描述之后，插入 `Runtime Tooling Filter` 段落。
- 要求 brainstorm 只提取会实质影响 brainstorming 的 product、workflow、scope、language、documentation 和 governance constraints。
- 要求 brainstorm 忽略 runtime tool-routing blocks、graph readiness rules、GitNexus / code-review-graph mandatory edit rules、MCP readiness notes 和 impact-analysis requirements；除非用户明确要求 technical architecture、code impact、reuse analysis 或 implementation planning。
- 明确禁止仅因为 instruction files 提到 `/spec:graph-bootstrap`、`$spec-graph-bootstrap`、GitNexus impact analysis 或 code-review-graph，就在 brainstorm 阶段运行这些工具。
- 仍允许读取代码库来验证与想法相关的可检查事实。

**遵循模式：**
- 当前 Phase 1.1 的 “Verify before claiming” 和 “Defer design decisions to planning” 规则。
- `tests/unit/spec-plan-contracts.test.js` 现有 contract-test 风格。

**测试场景：**
- 正常路径：`skills/spec-brainstorm/SKILL.md` 包含 `Runtime Tooling Filter`。
- 正常路径：contract test 断言 `Ignore runtime tool-routing blocks`。
- 正常路径：contract test 断言 `Do not run \`/spec:graph-bootstrap\`` 和 `$spec-graph-bootstrap`。
- 错误路径：contract test 断言 `solely because instruction files mention them`，防止未来 prose 被削弱。

**验证：**
- 如果 filter 被删除，或丢失 graph-bootstrap / impact-analysis guardrails，`tests/unit/spec-brainstorm-contracts.test.js` 会失败。

---

- U3. **明确 spec-plan 中 graph guidance 只是 evidence routing**

**目标：** 防止 `spec-plan` 把 instruction files 中的 runtime tool guidance 当作产品范围、用户需求或 mandatory setup work。

**需求：** R7

**依赖：** U1

**文件：**
- 修改：`skills/spec-plan/SKILL.md`
- 修改：`tests/unit/spec-plan-contracts.test.js`

**方法：**
- 在 `#### 1.1a Graph Readiness Facts (Optional, Bounded)` 下增加一句话。
- 这句话应说明：来自 `AGENTS.md` / `CLAUDE.md` 的 runtime tool guidance 是 execution evidence-routing guidance，不是 product scope，不是 user requirements，也不是要求把计划扩展成 tool setup；除非用户明确要求 setup。
- 不改变核心 Graph Readiness block contract。

**遵循模式：**
- 现有 `Graph Readiness Facts (Optional, Bounded)` 文案。
- 现有 `spec-plan context orientation contract` 测试。

**测试场景：**
- 正常路径：spec-plan contract test 断言 `execution evidence-routing guidance`。
- 正常路径：test 断言 `not product scope` 和 `not user requirements`。
- 回归：现有 graph readiness fields 保持不变。

**验证：**
- `tests/unit/spec-plan-contracts.test.js` 通过，并继续断言 graph readiness 是 evidence context，不是 planning gate。

---

- U4. **同步已提交的 root instruction files**

**目标：** 让当前仓库可见的 `AGENTS.md` 和 `CLAUDE.md` 与新 source template 对齐，同时保留外部 GitNexus blocks。

**需求：** R8

**依赖：** U1

**文件：**
- 修改：`AGENTS.md`
- 修改：`CLAUDE.md`

**方法：**
- U1 实现后，更新两个 root files 中的 `<!-- spec-first:runtime-tools:start -->` block。
- 优先通过 managed block path 重新生成；如果不方便，只从新的 `buildRuntimeToolsBlock()` 输出手工同步 managed runtime tools block。
- 不编辑 `<!-- gitnexus:start -->` 内容。
- 不编辑 `.agents/skills/`、`.claude/` 或 `.codex/` mirrors。

**遵循模式：**
- `applyManagedRuntimeToolsBlock()` 的 insertion / replacement behavior。
- `docs/solutions/workflow-issues/modify-source-not-artifacts-2026-04-13.md` 中的 source-not-artifacts learning。

**测试场景：**
- 正常路径：`AGENTS.md` 包含 scoped runtime tools block，且其中包含 `$spec-graph-bootstrap`。
- 正常路径：`CLAUDE.md` 包含 scoped runtime tools block，且其中包含 `/spec:graph-bootstrap`。
- 回归：两个文件都仍保留 `<!-- gitnexus:start -->`。
- 错误路径：两个 root files 的 runtime tools block 内都不再包含旧的未收窄文案 `优先遵守该块的强制规则`。

**验证：**
- source template 与 root files 对齐后，`spec-first init --codex --dry-run` / `spec-first init --claude --dry-run` 不应建议把 runtime tools block 回退成旧语义。

---

- U5. **更新 changelog 和验证覆盖**

**目标：** 记录这次 governance boundary 变化，并运行能证明它的窄范围测试。

**需求：** R9, R10

**依赖：** U1, U2, U3, U4

**文件：**
- 修改：`CHANGELOG.md`
- 测试：`tests/unit/runtime-tools-index.test.js`
- 测试：`tests/unit/spec-brainstorm-contracts.test.js`
- 测试：`tests/unit/spec-plan-contracts.test.js`
- 测试：如果 host-aware root instruction 断言受影响，则同步 `tests/unit/init-dry-run.test.js`

**方法：**
- 使用项目 developer profile author 在 `CHANGELOG.md` 追加记录（当前 Codex host 为 `leokuang`）。
- 先运行 focused Jest tests。
- 再运行 `npm run typecheck`。
- 如果 root instruction 或 init dry-run 断言变化超过 focused tests 覆盖范围，再运行 `npm run test:unit`。
- 提交前按仓库 GitNexus governance 运行 `gitnexus_detect_changes()`。

**测试场景：**
- 正常路径：focused unit tests 覆盖 runtime tools block scope、brainstorm filter 和 spec-plan graph guidance。
- 回归：现有 init dry-run tests 仍证明 host-specific `/spec:graph-bootstrap` 和 `$spec-graph-bootstrap` entries。
- 回归：改动 JS 文件通过 typecheck。

**验证：**
- 最小验证：`npx jest tests/unit/runtime-tools-index.test.js tests/unit/spec-brainstorm-contracts.test.js tests/unit/spec-plan-contracts.test.js --runInBand`
- 然后运行：`npm run typecheck`
- 更宽验证：当实现触及 root instruction generation 或现有 init tests 时，运行 `npm run test:unit`。

---

## 系统影响

- **交互图：** 主要行为面是 `spec-first init` 生成 root instruction files。`doctor` 和 `clean` 消费同一个 managed block shape，应保持兼容。
- **错误传播：** 在 root files 同步到新模板前，drift detection 可能把它们标成 drifted；这是实现期间的预期中间状态，应由 U4 收敛。
- **状态生命周期风险：** `buildKnownRuntimeToolsBodies()` 使用 generated known bodies 清理 corrupted stale sections。修改 body text 可能影响 stale-body cleanup；测试应继续保留 corrupted marker repair coverage。
- **API surface parity：** Claude 和 Codex 必须在使用 host-specific entry names 和 reference paths 的同时保持等价语义。
- **集成覆盖：** Init dry-run/apply tests 应继续证明生成的 root instruction files 包含 managed runtime tools block。
- **不变约束：** 外部 GitNexus blocks 被保留；graph-bootstrap 仍是显式 workflow；graph readiness 仍是 plan 和 execution workflows 的 optional evidence。

---

## 风险与依赖

| 风险 | 缓解 |
|------|------------|
| Runtime block prose 过弱，导致 agent 在代码工作中不再使用 GitNexus | 保留明确 guidance：代码库咨询优先 GitNexus，且 MUST rules 在代码编辑 / impact / pre-commit / review 场景生效 |
| Brainstorm filter 意外阻断有用的代码事实验证 | 保留现有 “Verify before claiming” 规则，并允许读取代码来验证与想法相关的可检查事实 |
| Root instruction files 与 source template 漂移 | 先更新 `runtime-tools-index.js`，再同步 `AGENTS.md` / `CLAUDE.md`，并依赖 `inspectRuntimeToolsIndexBlock()` 测试 |
| 英文和中文 generated blocks 语义分叉 | 在 runtime-tools tests 中增加英文专项断言 |
| 覆盖用户已有 worktree 改动 | 只编辑计划内文件；改动前检查 diff；不触碰无关既有修改 |
| `spec-plan` 当前已 dirty，实施时过度改动 | 只在 Graph Readiness 附近做手术式插入，并保留既有用户改动 |

---

## 文档与运维说明

- 这是 user-visible 变更，因为它会改变 `spec-first init --claude|--codex` 后安装到宿主中的 prompt 行为。
- README 不一定需要修改；除非现有 README prose 重复了旧的未收窄 runtime tools 语义。实现阶段做一次 bounded `rg` 检查即可。
- 生成的 runtime mirrors 只应在验证 host runtime behavior 时通过 `spec-first init` 刷新；除非仓库明确追踪 generated root instruction files，否则不应把它们作为 source edits 提交。当前 `AGENTS.md` / `CLAUDE.md` 被追踪，必须同步更新。

---

## 来源与参考

- 用户请求：将 graph / GitNexus / CRG 从全局 skill behavior 中收窄，尤其避免污染 `spec-brainstorm`。
- 相关既有计划：[docs/plans/2026-04-28-002-feat-runtime-tool-instruction-index-plan.md](docs/plans/2026-04-28-002-feat-runtime-tool-instruction-index-plan.md)
- 项目角色基线：[docs/10-prompt/项目角色.md](docs/10-prompt/项目角色.md)
- Runtime tools source：[src/cli/runtime-tools-index.js](src/cli/runtime-tools-index.js)
- Brainstorm workflow source：[skills/spec-brainstorm/SKILL.md](skills/spec-brainstorm/SKILL.md)
- Plan workflow source：[skills/spec-plan/SKILL.md](skills/spec-plan/SKILL.md)
- Root instruction files：[AGENTS.md](AGENTS.md), [CLAUDE.md](CLAUDE.md)
- 相关 learning：[docs/solutions/workflow-issues/modify-source-not-artifacts-2026-04-13.md](docs/solutions/workflow-issues/modify-source-not-artifacts-2026-04-13.md)
