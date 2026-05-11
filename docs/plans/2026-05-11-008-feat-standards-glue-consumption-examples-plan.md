---
title: "feat: standards/glue-map consumption examples v1"
type: feat
status: completed
date: 2026-05-11
spec_id: 2026-05-11-008-standards-glue-consumption-examples
origin: docs/2026-05-10/spec-first-full-code-review-and-competitor-benchmark.md
origin_issue: P2-004
---

# feat: standards/glue-map consumption examples v1

## Summary

本计划交付 `P2-004 standards/glue-map consumption examples` 的轻量版：新增一份集中消费示例文档，补齐 `confirmed` / `observed` / `imported` / `suggested` / `conflict` / `unknown` / degraded / `workspace-advisory-only` / `glue-map.json` 在 plan、task、work、review 中的正确用法，并用 contract tests 锁住这些示例不会漂移。

设计保持 light contract：不新增 standards schema、不改变 `.spec-first/standards/` producer、不扩展 graph/provider 协议，也不把 `glue-map.json` 变成 workflow state machine。示例只降低 LLM 和人工 reviewer 的误读风险，让下游 workflow 更稳定地区分 hard constraint、advisory context、risk context 和 question context。

## Problem Frame

`docs/2026-05-10/spec-first-full-code-review-and-competitor-benchmark.md` 将 `P2-004` 定位为 P2 阶段下一项建议开发任务：当前 `spec-plan`、`spec-write-tasks`、`spec-work` 和 `spec-code-review` 已经写明 standards/glue-map 的消费边界，但 examples 不够集中，agent 仍可能把 advisory facts 误读成 hard rule。

这个问题不是 schema 不足，而是消费心智不够具体：`standards-candidates.json` 已有 status 词表，`prepare-baseline.js` 已发布 downstream consumer modes，用户手册也说明 `confirmed` 才是硬约束；缺的是能让 plan/work/review 直接照着判断的正反示例。P2-004 应补示例和测试，不应引入新的规则引擎或产物目录。

## Requirements

- R1. 新增集中 examples 文档，覆盖 `confirmed`、`observed`、`imported`、`suggested`、`conflict`、`unknown`、`deprecated`、`drifted`、validator fail、missing validation result、`trust_level=degraded`、`consumption_boundary=advisory_only` 和 `workspace-advisory-only` 的下游消费语义。
- R2. 示例必须明确 `confirmed` 是 hard project context，`observed` / `imported` / `suggested` 是 advisory context，`conflict` / `deprecated` / `drifted` 是 risk context，`unknown` 是 question context，degraded/workspace advisory 只能 degraded/advisory consumption。
- R3. 示例必须分别覆盖 `spec-plan`、`spec-write-tasks`、`spec-work` 和 `spec-code-review`，说明每个 workflow 应如何消费 standards candidates 与 `glue-map.json`。
- R4. 示例必须明确 `glue-map.json` 只用于 reuse-first implementation/review questions，不能扩大 plan scope、改写 task-pack scope、替代 work scope 判断，或成为 workflow state machine。
- R5. 示例必须覆盖父 workspace advisory baseline 与 child repo confirmed baseline 的边界：父级 `--workspace` 产物不能当作 child repo 的 confirmed standards，遇到 `workspace-advisory-only` 时应建议运行 `$spec-standards --repo <child>` 获取 child-local baseline。
- R6. 用户手册和相关 skill source 只链接/引用集中 examples，避免在多个 prose 中复制大段规则形成第二真相源。
- R7. Contract tests 必须验证 examples 文档存在、关键消费模式齐全、关键 forbidden upgrade 明确，并验证相关 skill/manual 指向该 examples 文档。
- R8. 不修改 `.spec-first/standards/*` generated/advisory runtime artifacts，不新增 schema，不新增 CLI 行为，不改 graph provider contracts。
- R9. 因为实现会修改 `skills/*/SKILL.md` 的 source prose，实施验证必须包含 contract tests；如果语义行为需要验证且宿主能力允许，还应按 `docs/contracts/workflows/fresh-source-eval-checklist.md` 做 fresh-source eval，能力不足时明确记录未执行原因。

## Assumptions

- A1. P2-004 的首要价值是降低误读风险，不是提升 deterministic validation 能力；现有 `buildDownstreamConsumers()` 和 `tests/unit/spec-standards-consumers.test.js` 已足够表达机器层消费模式。
- A2. `docs/examples/` 目前不存在；本计划会创建该目录作为人读示例落点，而不是放进 `docs/contracts/`，因为这次交付是 consumption examples，不是新的 machine-readable contract。
- A3. 本计划不需要外部资料；正确性来自本仓库的角色契约、standards skill、用户手册、consumer tests 和 P2 backlog。

## Scope Boundaries

- 不修改 `skills/spec-standards/scripts/prepare-baseline.js` 的 producer 行为，除非实施时发现现有 consumer metadata 已与测试不一致。
- 不修改 `skills/spec-standards/examples/*.json` 作为主要交付；这些是 artifact-shaped examples，P2-004 需要的是 downstream consumption examples。
- 不把 examples 文档变成规范注册表、决策表引擎、状态机或 reviewer 自动判定规则。
- 不新增 `.spec-first/standards/` durable artifact、workflow run artifact、dashboard、history store 或 schema version。
- 不手改 `.claude/`、`.codex/`、`.agents/skills/` generated runtime mirrors。

### Deferred to Follow-Up Work

- 如果未来多个下游 workflow 需要机器读取示例，再评估是否引入 examples manifest；v1 只做人读文档 + contract tests。
- 如果未来 standards baseline 被更广泛消费，再评估是否把 consumption examples 纳入 `spec-standards --baseline` 输出摘要；v1 不扩展 producer。
- 父 workspace 与 child repo 的自动 target routing 改进另行处理；P2-004 只解释 `workspace-advisory-only` 的消费边界。

## Graph Readiness

- status: stale
- source_revision: `b5ca72a99056fb2dc6c21b6e0c063c5d6b8203a7`
- current_revision: `9d6d64072b960c0f8b8fe6789b80bbe7c3a617ca`
- stale: true
- primary_providers: `code-review-graph`, `gitnexus`
- degraded_providers: none in compiled artifact
- fallback_capabilities: direct repo reads, existing unit contract tests, standards/manual source inspection
- runtime_mcp_evidence: not used as primary planning evidence
- confidence: medium
- limitations: compiled graph facts are from an older source revision and record a dirty worktree; this lightweight docs/test plan relies on direct source reads and existing contract tests as primary evidence.

## Context & Research

### Relevant Code and Patterns

- `skills/spec-standards/SKILL.md` defines the core contract: scripts prepare facts, LLM decides standards, observed/imported/suggested are not confirmed, validate before trusted consumption, and `advisory` is a consumption mode, not candidate status.
- `skills/spec-standards/scripts/prepare-baseline.js` exports `buildDownstreamConsumers()` with shared `hard_context` / `advisory_context` / `risk_context` / `question_context` / `degraded_context` / `glue_map_boundary` metadata.
- `tests/unit/spec-standards-consumers.test.js` already locks the status-to-consumption map and checks `spec-plan`, `spec-write-tasks`, `spec-work`, and `spec-code-review` prose.
- `docs/05-用户手册/11-项目规范与胶水基线.md` already explains artifact boundaries, validator trust levels, workspace advisory boundary, and `glue-map.json` reuse-first scope.
- `skills/spec-standards/examples/standards-candidates.example.json` and `skills/spec-standards/examples/glue-map.example.json` provide artifact-shaped examples, but they do not give concentrated workflow-specific consumption examples.

### Institutional Learnings

- `docs/solutions/workflow-issues/modify-source-not-artifacts-2026-04-13.md` reinforces that durable fixes should land in source-of-truth paths, not generated runtime mirrors.
- `docs/solutions/workflow-issues/host-entrypoint-mapping-source-boundary-2026-04-29.md` reinforces keeping host entrypoint mapping out of ordinary shared prose; examples should say current host where possible and avoid duplicating host-specific command tables.
- `docs/solutions/workflow-issues/doc-review-codex-multi-agent-dispatch-boundary-2026-05-05.md` reinforces that workflow-owned review phases need explicit degraded/fallback reporting; P2-004 examples should not silently upgrade advisory facts into reviewer findings.

### External References

- No external references were used. P2-004 is bounded by current repo contracts and the P2 backlog source.

## Key Technical Decisions

- D1. Put the central examples in `docs/examples/standards-glue-consumption-examples.md`. Rationale: the work is example/documentation-oriented; `docs/contracts/` would imply a new durable contract surface, which is unnecessary for v1.
- D2. Keep `.spec-first/standards/*` out of the implementation. Rationale: those are generated/advisory runtime artifacts and should not become committed source.
- D3. Add references from `spec-standards`, `spec-plan`, `spec-write-tasks`, `spec-work`, and `spec-code-review`, but keep the detailed examples centralized. Rationale: consumers need discoverability without creating many copies of the same rule table.
- D4. Use contract tests over prose presence, not snapshot tests. Rationale: the goal is preventing semantic drift while preserving freedom to improve wording.
- D5. Treat examples as guidance for LLM-owned judgment. Rationale: scripts already expose the deterministic status map; examples should help agents reason, not replace agent judgment with a hard-coded rule engine.

## Open Questions

### Resolved During Planning

- Should P2-004 create a new standards artifact? Resolved: no. Existing artifacts and consumer metadata already carry the deterministic contract; v1 should add examples and tests only.
- Should examples live under `skills/spec-standards/examples/`? Resolved: no as the primary target. Existing files there are artifact examples; downstream consumption examples belong in docs and should be linked from skills.
- Should `glue-map.json` consumption be expanded beyond reuse-first? Resolved: no. The plan explicitly keeps it out of workflow state, scope authority, and review result authority.

### Deferred to Implementation

- Exact wording of each good/bad example: implementer can adjust phrasing as long as tests preserve the required consumption semantics.
- Whether to include `spec-brainstorm` in the examples matrix: optional. It appears in `buildDownstreamConsumers()`, but P2-004 backlog names plan/work consumption; implementer may include a short brainstorm row if it keeps the document clearer without expanding scope.

## Output Structure

    docs/
      examples/
        standards-glue-consumption-examples.md

## Implementation Units

### U1. Add central consumption examples doc

**Goal:** Create the concentrated human-readable examples P2-004 asks for.

**Requirements:** R1, R2, R3, R4, R5, R8

**Dependencies:** None

**Files:**
- Create: `docs/examples/standards-glue-consumption-examples.md`
- Modify: `tests/unit/spec-standards-consumers.test.js`

**Approach:**
- Add a short purpose section that states: examples clarify downstream consumption; they are not a new schema, producer, rule engine, or workflow state machine.
- Add a status-to-consumption table:
  - `confirmed` -> hard context / may become plan constraint, task constraint, work constraint, or hard review criterion.
  - `observed` / `imported` / `suggested` -> advisory context / may inform choices, but cannot become a hard rule or expand scope.
  - `conflict` / `deprecated` / `drifted` -> risk context / must be resolved, called out, or carried as risk, not silently overridden.
  - `unknown` -> question context / ask, assume explicitly, or defer.
  - validator fail / missing validator result / `trust_level=degraded` / `consumption_boundary=advisory_only` / `workspace-advisory-only` -> degraded/advisory only.
- Add workflow-specific good/bad examples for `spec-plan`, `spec-write-tasks`, `spec-work`, and `spec-code-review`.
- Add a `workspace-advisory-only` example showing parent workspace baseline cannot be treated as child repo confirmed standards and should lead to `$spec-standards --repo <child>` when child-local confirmation is needed.
- Add a `glue-map.json` section showing it can suggest reuse-first capability lookup and review questions, but cannot choose scope, mark work done, or create a workflow state machine.

**Execution note:** Keep examples compact. If the doc starts looking like a full manual or standards DSL, stop and simplify.

**Patterns to follow:**
- `docs/05-用户手册/11-项目规范与胶水基线.md` for terminology and boundaries.
- `tests/unit/spec-standards-consumers.test.js` for canonical status/mode wording.
- `skills/spec-standards/examples/standards-candidates.example.json` for candidate ids and status examples.

**Test scenarios:**
- Contract: examples doc exists at `docs/examples/standards-glue-consumption-examples.md`.
- Contract: examples doc contains each status/mode mapping, including degraded/workspace advisory cases.
- Contract: examples doc contains `spec-plan`, `spec-write-tasks`, `spec-work`, and `spec-code-review` sections or rows.
- Contract: examples doc says advisory facts cannot become hard rules or expand source scope.
- Contract: examples doc says `glue-map.json` is reuse-first context and not a workflow state machine.
- Contract: examples doc says parent workspace advisory baseline is not a child repo confirmed baseline.

**Verification:**
- `npx jest tests/unit/spec-standards-consumers.test.js --runInBand`

### U2. Link examples from standards user guide and standards skill

**Goal:** Make the new examples discoverable from the standards workflow and user documentation without duplicating the full table.

**Requirements:** R6, R8, R9

**Dependencies:** U1

**Files:**
- Modify: `docs/05-用户手册/11-项目规范与胶水基线.md`
- Modify: `skills/spec-standards/SKILL.md`
- Modify: `tests/unit/user-manual-contracts.test.js`
- Modify: `tests/unit/spec-standards-contracts.test.js`

**Approach:**
- In the user guide, add a short "下游消费示例" pointer near the existing "产物边界" or downstream consumption paragraph.
- In `skills/spec-standards/SKILL.md`, add a source pointer to the examples doc in the downstream consumption / artifact contract area.
- Keep the canonical vocabulary in `spec-standards` unchanged: `confirmed`, `imported`, `observed`, `suggested`, `conflict`, `unknown`, `deprecated`, `drifted`; do not add `advisory` as a candidate status.
- Add tests that the manual and skill point to `docs/examples/standards-glue-consumption-examples.md`.

**Execution note:** This is a source prose change. Do not edit generated runtime mirrors; runtime refresh, if needed later, belongs to `spec-first init`.

**Patterns to follow:**
- Existing user manual contract tests for standalone guide discoverability.
- Existing standards contract tests that assert workflow boundaries and status vocabulary.

**Test scenarios:**
- Contract: user manual links to the examples doc.
- Contract: `spec-standards` source skill links to the examples doc.
- Contract: neither file says advisory is a candidate status.
- Contract: neither file suggests examples are machine-readable schema or generated artifacts.

**Verification:**
- `npx jest tests/unit/user-manual-contracts.test.js tests/unit/spec-standards-contracts.test.js --runInBand`
- Fresh-source eval for `skills/spec-standards/SKILL.md` source pointer if semantic behavior verification is needed and host dispatch is available; otherwise record the concrete not-run reason.

### U3. Add consumer workflow pointers without duplicating rules

**Goal:** Ensure downstream workflows can find the examples when they consume standards/glue-map context.

**Requirements:** R3, R4, R6, R7, R8, R9

**Dependencies:** U1

**Files:**
- Modify: `skills/spec-plan/SKILL.md`
- Modify: `skills/spec-write-tasks/SKILL.md`
- Modify: `skills/spec-work/SKILL.md`
- Modify: `skills/spec-code-review/SKILL.md`
- Modify: `tests/unit/spec-plan-contracts.test.js`
- Modify: `tests/unit/spec-write-tasks-contracts.test.js`
- Modify: `tests/unit/spec-work-contracts.test.js`
- Modify: `tests/unit/spec-code-review-contracts.test.js`

**Approach:**
- Add a one-sentence pointer near each workflow's standards/glue-map consumption anchor.
- Preserve the existing compact consumption rules already present in each skill.
- Do not copy the full examples table into each skill. The skill should remain the runtime contract; the examples doc provides explanatory examples.
- For `spec-code-review`, make the pointer explicit that examples do not authorize hard findings from advisory/degraded baselines.

**Execution note:** Keep edits small and local to existing standards/glue-map anchors. If a workflow lacks a nearby anchor during implementation, create the smallest local pointer rather than restructuring the skill.

**Patterns to follow:**
- `skills/spec-plan/SKILL.md` Context Orientation Anchor.
- `skills/spec-write-tasks/SKILL.md` source reads before task-pack generation rule.
- `skills/spec-work/SKILL.md` Phase guidance around project coding standards.
- `skills/spec-code-review/SKILL.md` Stage 3b standards paths discovery.

**Test scenarios:**
- Contract: each consumer skill references `docs/examples/standards-glue-consumption-examples.md`.
- Contract: existing hard/advisory/risk/question/degraded boundaries remain present.
- Contract: `glue-map.json` remains reuse-first context and not a workflow state machine.
- Contract: `spec-code-review` still says only confirmed standards may become hard findings.

**Verification:**
- `npx jest tests/unit/spec-plan-contracts.test.js tests/unit/spec-write-tasks-contracts.test.js tests/unit/spec-work-contracts.test.js tests/unit/spec-code-review-contracts.test.js --runInBand`
- Fresh-source eval for the changed consumer skill source files if semantic behavior verification is needed and host dispatch is available; otherwise record the concrete not-run reason.

### U4. Update backlog status and changelog after implementation

**Goal:** Keep the P2 tracking document and changelog aligned once P2-004 lands.

**Requirements:** R7, R8

**Dependencies:** U1, U2, U3

**Files:**
- Modify: `docs/2026-05-10/spec-first-full-code-review-and-competitor-benchmark.md`
- Modify: `CHANGELOG.md`

**Approach:**
- In the P2-004 section, mark v1 as fixed only after U1-U3 tests pass.
- Record exactly what landed: central examples doc, user guide/skill pointers, consumer contract tests.
- Add a `CHANGELOG.md` entry following the repository format and current Codex developer profile author.

**Execution note:** During this planning-only change, only the plan creation gets a changelog entry. The implementation changelog and backlog fixed status belong to the later `spec-work` run.

**Patterns to follow:**
- Existing P2-002 / P2-007 / P2-009 status updates in the benchmark/review document.
- Current `CHANGELOG.md` single-line entry format.

**Test scenarios:**
- Contract: benchmark/review doc no longer lists P2-004 as pending after implementation.
- Contract: changelog entry follows `- vX.Y.Z YYYY-MM-DD HH:MM:SS leokuang: ...` format.

**Verification:**
- `npx jest tests/unit/changelog-format.test.js --runInBand`
- `git diff --check`

## System-Wide Impact

- **Interaction graph:** `spec-standards` remains the producer of standards/glue-map facts; `spec-plan`, `spec-write-tasks`, `spec-work`, and `spec-code-review` remain semantic consumers. P2-004 adds example context and tests, not a new workflow edge.
- **Error propagation:** No runtime errors or new exit codes. Misread standards should become less likely because examples and contract tests make forbidden upgrades visible.
- **State lifecycle risks:** No new persistent state. `.spec-first/standards/` remains generated/advisory runtime workspace and is not committed.
- **API surface parity:** No CLI, schema, or command API changes. Both Claude and Codex runtime assets will inherit source prose only after normal `spec-first init --claude|--codex` regeneration.
- **Integration coverage:** Unit contract tests are the primary v1 proof because the change is docs/prose guidance. For skill source prose changes, add fresh-source eval when semantic behavior verification is needed and host dispatch is available; no smoke/integration test is required unless implementation unexpectedly changes CLI/runtime behavior.
- **Unchanged invariants:** Only `confirmed` can be treated as hard standards context; advisory/degraded/workspace advisory facts cannot become hard rules; `glue-map.json` is reuse-first context, not source of scope or workflow state.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Examples duplicate existing contract prose and become a second truth source | Keep details centralized in one examples doc; skills/manual link to it and retain only compact canonical rules. |
| Examples accidentally make advisory standards feel mandatory | Include explicit bad examples and tests for "cannot become hard rule" and "cannot expand source scope". |
| `docs/examples/` becomes a dumping ground | Scope this plan to one document; defer any examples catalog/index until repeated need appears. |
| Skill prose changes are cached in current host runtime | Treat `skills/` as source; do not hand-edit `.agents/skills/`; note runtime regeneration separately if a later run needs live command behavior refreshed. |
| Contract tests become brittle prose snapshots | Assert key semantic phrases and paths, not entire paragraphs. |

## Documentation / Operational Notes

- This is user-visible documentation and workflow-guidance work.
- Implementation should update `CHANGELOG.md`.
- Runtime regeneration is not part of P2-004 implementation unless the user explicitly wants refreshed local host assets after source changes.
- A later code review should treat this as docs/prose/tests change; no API migration or release package evidence is expected.

## Sources & References

- **Origin document:** `docs/2026-05-10/spec-first-full-code-review-and-competitor-benchmark.md`
- Role baseline: `docs/10-prompt/结构化项目角色契约.md`
- Standards workflow: `skills/spec-standards/SKILL.md`
- Standards producer logic: `skills/spec-standards/scripts/prepare-baseline.js`
- Consumer contract tests: `tests/unit/spec-standards-consumers.test.js`
- User guide: `docs/05-用户手册/11-项目规范与胶水基线.md`
- Existing artifact examples: `skills/spec-standards/examples/standards-candidates.example.json`, `skills/spec-standards/examples/glue-map.example.json`
- Source/runtime learning: `docs/solutions/workflow-issues/modify-source-not-artifacts-2026-04-13.md`
