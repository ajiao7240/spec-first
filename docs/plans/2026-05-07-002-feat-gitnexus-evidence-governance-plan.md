---
title: feat: 收紧 GitNexus 证据层与全流程图谱治理
type: feat
status: active
date: 2026-05-07
spec_id: 2026-05-07-002-gitnexus-evidence-governance
---

# feat: 收紧 GitNexus 证据层与全流程图谱治理

## 概览

本计划优化 spec-first 当前 GitNexus 接入方式。目标不是做单点命令修补，而是把 GitNexus 作为贯穿 `Codebase -> Graph -> Spec -> Plan -> Tasks -> Code -> Review -> Knowledge` 的外部证据层来治理。

当前方向总体正确：GitNexus 提供代码图谱、执行流、影响分析和 live MCP 代码智能；spec-first 负责 workflow harness、readiness artifacts、source/runtime 边界、LLM handoff 和审查闭环。需要优化的是：防止 GitNexus bootstrap 改写 source 入口文档，统一 compiled graph facts / live MCP / fallback direct reads 的消费规则，并避免 GitNexus hard gate 变成替代 LLM 判断的状态机。

## 目标

- 防止 `gitnexus analyze` 隐式改写 `AGENTS.md` / `CLAUDE.md`。
- 建立全流程统一的图谱证据策略。
- 保留 GitNexus-first 的代码理解优势，同时支持 stale / degraded / definitions-only 的明确降级。
- 让 `spec-plan`、`spec-work`、`spec-debug`、`spec-code-review`、`spec-work-beta` 以同一套 freshness 规则消费 graph facts。
- 保持多仓 workspace 的 child repo ownership，不把 parent workspace 伪装成 repo。
- 让 `gitnexus_detect_changes()` 成为 review evidence，而不是无法解释的自动阻断器。

## 非目标

- 不重写 GitNexus 或 fork provider。
- 不恢复 retired internal CRG runtime。
- 不把 GitNexus group mode 纳入默认核心路径。
- 不让 scripts 根据用户问题做业务语义判断。
- 不手改 `.claude/`、`.codex/`、`.agents/skills/` generated runtime mirrors。
- 不把 graph facts 做成第二份 plan 或中心化 workflow state。

## 图谱就绪状态

- target_repo: `spec-first`
- status: `stale`
- source_revision: `052c94ba77ef4a5a5de9f98f2fb065a1e11e4c5d`
- current_revision: `052c94ba77ef4a5a5de9f98f2fb065a1e11e4c5d`
- stale: true，因为当前 dirty worktree fingerprint 与 compiled graph facts 不一致
- primary_providers: `gitnexus`, `code-review-graph`
- degraded_providers: compiled provider status 中没有 degraded provider
- fallback_capabilities: `serena`, `ast-grep`, bounded direct repo reads
- runtime_mcp_evidence: 当前 session 中 GitNexus MCP 可用，但 live MCP evidence 仍然只是 session-local evidence
- confidence: medium
- limitations: 实施阶段在编辑 shared symbol 前必须重新运行聚焦 impact analysis；提交前必须运行 final change detection

## 需求追踪

- R1. GitNexus provider bootstrap 不得修改已纳入版本控制的 host source 文档。
- R2. Setup 与 bootstrap 职责必须保持分离：setup 投影 facts，bootstrap 运行 provider commands。
- R3. `query_ready=true` 必须要求 analyze/build、status 和 query-surface proof 都通过。
- R4. Definitions-only GitNexus evidence 只能作为 pointer-level evidence，不能作为 process/query readiness。
- R5. Live MCP evidence 永远不得反写 compiled graph readiness。
- R6. Downstream workflows 在把 graph facts 当作 primary evidence 前，必须比较 `source_revision`、`worktree_dirty` 和 `worktree_status_hash`。
- R7. Parent workspace 的只读 routing 可以使用 `workspace-graph-targets.v1`；写入 workflow 仍必须有 explicit `target_repo`。
- R8. GitNexus HIGH/CRITICAL risk 必须通过解释和验证来处理，不能盲目接受或忽略。
- R9. 所有 source changes 必须同步更新 `CHANGELOG.md`。

## 关键决策

- D1. 在 GitNexus analyze command projection 中加入 `--skip-agents-md`。
- D2. 保持 GitNexus 为 `global_knowledge`；保持 code-review-graph 为 `impact_context`。
- D3. 不把 GitNexus group mode 做成默认要求。多仓基础策略仍是 per-repo bounded fan-out。
- D4. 用 freshness-aware、scope-aware 规则替换绝对化的 GitNexus hard-gate 文案。
- D5. 在 freshness 验证前，把 graph evidence 视为 advisory。
- D6. 保持 script-owned outputs deterministic：readiness facts、reason codes、raw logs、artifact paths。
- D7. 保持 LLM-owned decisions semantic：target repo relevance、implementation scope、risk interpretation、fallback choice。

## 实施单元

### U1. 定义图谱证据策略

文件：

- `docs/contracts/graph-evidence-policy.md`
- `README.md`
- `README.zh-CN.md`

变更：

- 定义共享术语：`primary`、`stale`、`dirty-uncertain`、`degraded-fallback`、`definitions-only`、`session-local evidence`、`target_repo required`。
- 文档化 compiled facts、live MCP 和 fallback reads 的消费规则。
- 明确 provider facts 不替代 LLM judgment。

测试：

- 如果现有 docs contracts 覆盖 README/governance 文案，新增或更新对应 Jest 断言。

### U2. 防止 GitNexus 修改 source 文档

文件：

- `skills/spec-mcp-setup/scripts/write-provider-config.sh`
- `skills/spec-mcp-setup/scripts/write-provider-config.ps1`
- `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh`
- `skills/spec-graph-bootstrap/scripts/bootstrap-providers.ps1`
- `skills/spec-graph-bootstrap/SKILL.md`

变更：

- 将 GitNexus bootstrap 投影为 `npx -y <gitnexus-package> analyze --force --skip-agents-md`。
- 更新 command shape allowlists。
- 更新 skill 文案，解释 provider bootstrap 为什么不得触碰 host source 文档。
- 如果当前 pinned GitNexus package 不支持 `--skip-agents-md`，通过现有 provider registry path 更新 package pin，或执行 fail closed。

测试：

- `tests/unit/mcp-setup.sh`
- `tests/unit/spec-graph-bootstrap.sh`
- `tests/unit/mcp-setup-powershell-contracts.test.js`

场景：

- Provider config 包含 `--skip-agents-md`。
- Bootstrap allowlist 接受新的 argv。
- Unsafe shell/string command 仍然被拒绝。
- Graph bootstrap 后 fixture `AGENTS.md` / `CLAUDE.md` 保持不变。

### U3. 重写 GitNexus host instruction 边界

文件：

- `AGENTS.md`
- `CLAUDE.md`
- `src/cli/instruction-bootstrap.js`
- `tests/unit/runtime-tools-index.test.js`
- `tests/unit/clean-dry-run.test.js`

变更：

- 将 blanket “never edit any symbol without GitNexus impact” 改为 scope-aware 规则：
  - production function/class/method/API/shared contract changes 需要 attempted impact analysis；
  - docs-only/prose/changelog/fixture changes 可以使用更轻量的 scoped review；
  - stale/unavailable GitNexus 必须记录 fallback evidence；
  - HIGH/CRITICAL risk 需要 explanation 和 verification，不自动停止。
- 如果当前测试要求保留 external GitNexus block markers，则保留 markers，但将内容对齐 spec-first source/runtime boundary。

测试：

- 现有 cleanup tests 仍然保留 GitNexus block。
- 新增断言覆盖 freshness-aware wording 和 degraded fallback wording。

### U4. 统一下游 graph consumption

文件：

- `skills/spec-plan/SKILL.md`
- `skills/spec-work/SKILL.md`
- `skills/spec-debug/SKILL.md`
- `skills/spec-code-review/SKILL.md`
- `skills/spec-work-beta/SKILL.md`

变更：

- 每个消费 graph facts 的 workflow 必须检查：
  - `source_revision` 与当前 `HEAD`；
  - `worktree_dirty` 与当前 dirty state；
  - 存在时检查 `worktree_status_hash`。
- 如果不匹配：报告 `stale` 或 `dirty-uncertain`。
- 如果 GitNexus 返回 definitions-only：只能作为 symbol/file pointer。
- 如果 live MCP 成功：标记为 `session-local`，不是 compiled readiness。

测试：

- `tests/unit/spec-plan-contracts.test.js`
- `tests/unit/spec-work-contracts.test.js`
- `tests/unit/spec-debug-contracts.test.js`
- `tests/unit/spec-work-beta-contracts.test.js`
- 如存在相关覆盖，则更新 `tests/unit/spec-code-review-contracts.test.js`

### U5. 澄清 review 与 commit evidence

文件：

- `skills/spec-code-review/SKILL.md`
- `skills/spec-work/SKILL.md`
- `docs/contracts/graph-evidence-policy.md`

变更：

- 定义 `gitnexus_detect_changes()` 的预期用法：
  - commit candidate 已 staged 时优先使用 staged scope；
  - 否则说明分析使用 all 或 uncommitted scope；
  - 通过 changed symbols/processes 和 task scope 解释 HIGH/CRITICAL 结果；
  - 列出缓解风险的 verification commands。
- 明确 detect_changes 不覆盖每个 docs/changelog artifact，因此 final review 仍必须检查 non-symbol source changes。

测试：

- Prose contract assertions 锁定 `detect_changes` 是 evidence，不是 absolute gate。
- 现有 validation logs 可以保留历史状态；不要重写旧 logs。

### U6. 强化 query probe golden cases

文件：

- `skills/spec-graph-bootstrap/evals/*.json`
- `tests/unit/mcp-setup.sh`
- 可能涉及 `tests/fixtures/`

变更：

- 增加以下场景：
  - 包含 parse/validate methods 的 CLI repo；
  - Spring/Java controller-heavy repo；
  - Android Activity/ViewModel repo；
  - health-only repo；
  - README-only/no-source repo；
  - display-only frontend component repo。
- 确认 candidate selection 保持 bounded 且 source-derived。
- 确认 health/status/display-only tokens 不会优先于 flow-bearing tokens。

测试：

- 现有 mcp-setup query probe candidate tests。
- 如果存在 eval fixture schema checks，则同步更新。

### U7. 文档、changelog 与 runtime 验证

文件：

- `README.md`
- `README.zh-CN.md`
- 相关用户手册文档
- `CHANGELOG.md`
- generated runtime expectations 只能通过 source templates 和 tests 更新

变更：

- 文档化更新后的 graph evidence lifecycle。
- 说明何时运行 `$spec-mcp-setup`、`$spec-graph-bootstrap` 和 downstream workflows。
- 使用当前 Codex developer profile 增加 changelog 记录。
- 不直接编辑 generated runtime mirrors。
- 如需 runtime regeneration，在 source validation 后使用 `spec-first init --codex` / `spec-first init --claude`。

测试：

- `npm run lint:skill-entrypoints`
- 如存在 README / dual-host governance tests，则同步运行。

## 执行顺序

1. U1：定义 policy vocabulary 和共享规则。
2. U2：修复 GitNexus command projection 和 bootstrap allowlist。
3. U3：对齐 host instruction 规则。
4. U4：对齐 downstream workflow consumption。
5. U5：澄清 review/commit evidence semantics。
6. U6：增加 probe golden cases。
7. U7：更新 docs、changelog 和 runtime expectations。

## 验证计划

聚焦验证：

```bash
npm run test:mcp-setup
npm run test:graph-bootstrap
npm run lint:skill-entrypoints
npm run typecheck
```

扩大验证：

```bash
npm run test:unit
npm test
```

图谱专项验证：

- 编辑 shared JS functions 或 CLI behavior 前运行 GitNexus impact。
- 提交前运行 GitNexus change detection。
- 如果 GitNexus 报告 HIGH/CRITICAL，记录它是 expected broad contract impact 还是 unexpected blast radius。

运行时与 source 验证：

- 确认没有直接编辑 `.claude/`、`.codex/`、`.agents/skills/`。
- 如果 source changes 影响 generated host runtime，只能在 tests 通过后通过 `spec-first init --codex|--claude` 重新生成。

## 风险与缓解

- 风险：GitNexus pinned version 可能不支持 `--skip-agents-md`。
  - 缓解：先验证 CLI 支持；如果不支持，则更新 provider package pin 或执行 fail closed。
- 风险：移除 hard-gate wording 会弱化安全性。
  - 缓解：保留 symbol/API impact requirement，但明确 degraded fallback。
- 风险：更多 workflow 会报告 stale graph facts。
  - 缓解：这是预期行为；stale evidence 应降级到 bounded direct reads。
- 风险：多个文件重复类似 graph evidence rules。
  - 缓解：在 `docs/contracts/graph-evidence-policy.md` 中集中 vocabulary；skills 只引用 policy 并保留 workflow-specific behavior。
- 风险：GitNexus group mode 对多仓看起来很有吸引力。
  - 缓解：延后到 follow-up；核心路径保持 provider-neutral 和 per-repo bounded。

## 交接标准

本计划在以下条件满足时可以进入 `$spec-work`：

- 实施目标已确认为 `spec-first`。
- 现有 unrelated worktree changes 已纳入 scope，或明确忽略。
- 实施者从 U1/U2 开始，而不是先改孤立的 host prose。
- 最终 PR 包含 test output、GitNexus change-detection interpretation 和 generated runtime impact statement。
