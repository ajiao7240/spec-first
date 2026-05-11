---
title: "feat: AI dev benchmark fixture suite full closure v1"
type: feat
status: completed
date: 2026-05-11
spec_id: 2026-05-11-009-ai-dev-benchmark-full-closure
origin: docs/2026-05-10/spec-first-full-code-review-and-competitor-benchmark.md
origin_issue: P2-003
---

# feat: AI dev benchmark fixture suite full closure v1

## Summary

本计划交付 `P2-003 benchmark/eval fixture suite full closure` 的轻量版：在现有 AI dev benchmark v1 foundation 上补齐 `api-contract` 与 `multi-module-refactor` 两个高价值 fixture，并为至少一个 fixture 增加一次真实 LLM-review / workflow-output 语义对照 evidence。

设计继续保持 light contract：runner 只验证 fixture、路径、schema 与 evidence shape；LLM/reviewer 负责语义判断。Benchmark 仍是 advisory quality signal，不成为 release hard gate，不做 dashboard、leaderboard、历史趋势、模型评分或自动 agent 执行平台。

---

## Problem Frame

当前 `P2-003` 已完成 v1 foundation：仓库已有 `docs-only`、`cli-bugfix`、`graph-degraded-fallback` 三个 repo-like fixtures、manifest/result schema、deterministic runner、`test:ai-dev:benchmarks` 与 advisory `test:ai-dev:gate` 聚合。

这个 foundation 证明了 benchmark input 与 evidence shape 可消费，但还没有覆盖两个更接近真实 AI coding 风险的场景：

- API contract 变更时，handler、consumer、contract doc 和 tests 是否能保持一致。
- 单 repo 多 module/refactor 场景中，plan/work/review 是否会扩大 scope 或跨模块乱改。

同时，现有 runner 不执行真实 `$spec-work` / agent，也不评价 LLM 语义质量。Full closure 的目标不是把 runner 变成评分器，而是补一个最小语义对照 evidence，让维护者和 reviewer 能看到至少一个 fixture 的 expected output 是否被 LLM/reviewer 按 spec-first 边界审过。

---

## Requirements

- R1. 将 benchmark fixture suite 从 3 类扩展到 5 类：`docs-only`、`cli-bugfix`、`graph-degraded-fallback`、`api-contract`、`multi-module-refactor`。
- R2. 新增 `api-contract` fixture，覆盖 API response / consumer expectation / contract doc / targeted test / changelog 的一致性边界。
- R3. 新增 `multi-module-refactor` fixture，覆盖单 repo 多 module scope boundary，expected changed paths 只能落在目标 module、相关 tests 和 changelog。
- R4. 至少一个 fixture 必须包含 `semantic-review` evidence artifact，记录一次真实 LLM-review 或 workflow-output review pass 的输入、检查项、结论和限制。
- R5. Manifest schema 与 runner 必须支持新增 scenario types 和可选 `semantic_review` evidence object；semantic review evidence 必须是文件路径证据，不是 expected workflow artifact，也不是 runner 生成的语义分数。
- R6. Runner 仍只做 deterministic validation：schema、safe path、fixture presence、`semantic_review.artifact_path` existence；不得调用 LLM、不得执行 `$spec-work`、不得改 fixture repo。
- R7. `test:ai-dev:gate` 继续把 benchmark check 标为 advisory；gate-level `passed` 与 blocking `failures` 不受 advisory benchmark failures 影响。
- R8. Contract tests 必须覆盖 5 个 checked-in fixtures、新 scenario enums、semantic-review artifact visibility、invalid semantic-review path、advisory aggregation 仍不阻断。
- R9. 文档必须把 `P2-003` 从 `v1 foundation complete / full closure pending` 校准为 `full closure v1 fixed`，同时保留 benchmark 不评分、不平台化、不作为 release hard gate 的边界。
- R10. 不修改 `.spec-first/workflows/quality-gates/*` checked-in runtime artifact；这些是命令运行时输出，不作为 source truth 提交。

---

## Assumptions

- A1. `P2-003` 的 full closure 只需要补齐高价值 fixture 与一次语义对照 evidence，不需要真实自动执行 `$spec-work`。
- A2. `api-contract` 与 `multi-module-refactor` 比增加更多 docs/CLI 变体更能证明 spec-first 对工程边界的价值。
- A3. Semantic review evidence 可以是人工/LLM 复审 artifact，但必须清楚说明是否实际执行了 workflow，不能把 review-over-expected-output 伪装成真实 run result。

---

## Scope Boundaries

- 不新增 dashboard、leaderboard、scoreboard、history store、telemetry 或 model comparison。
- 不让 runner 自动调用 agent、workflow、MCP provider 或外部服务。
- 不把 benchmark 结果升级为 release hard gate。
- 不把 semantic-review artifact 做成通用评分 schema 或 reviewer 状态机。
- 不扩展到 API contract 与 multi-module 之外的更多 fixture 类型。
- 不手改 generated runtime mirrors，也不提交 `.spec-first/workflows/quality-gates/*` 命令输出。

### Deferred to Follow-Up Work

- 自动执行真实 `$spec-work` 并采集 run artifact：等 `spec-work` planned run artifact producer 真正实现后再评估。
- 多轮模型对比、历史趋势、dashboard：保持在核心路径之外，未来如需要也应作为 optional external plugin。
- 将 benchmark failures 变成 release blocking policy：只有当 semantic evidence 充分且维护者明确需要时另行规划。

---

## Graph Readiness

- status: stale
- source_revision: `b5ca72a99056fb2dc6c21b6e0c063c5d6b8203a7`
- current_revision: `8c06735a7c2383e79be90be09e8a708636c3644e`
- stale: true
- primary_providers: `code-review-graph`, `gitnexus`
- degraded_providers: none in compiled artifact
- fallback_capabilities: direct repo reads, existing benchmark/unit tests, live GitNexus session-local query for related symbols
- runtime_mcp_evidence: partial session-local GitNexus query found `scripts/run-ai-dev-quality-gate.js:runAiDevQualityGate` and related tests, but compiled graph facts remain stale
- confidence: medium
- limitations: compiled graph facts were generated at an older revision and dirty worktree snapshot; this plan relies on direct source reads and current fixture/test files as primary evidence.

---

## Context & Research

### Relevant Code and Patterns

- `docs/plans/2026-05-11-003-feat-ai-dev-benchmark-fixtures-plan.md` defines the v1 foundation and explicitly states full closure requires API contract fixture, multi-module refactor fixture, and at least one semantic workflow/LLM-review pass.
- `docs/contracts/quality-gates/ai-dev-benchmark-fixture.schema.json` currently allows only `docs-only`, `cli-bugfix`, and `graph-degraded-fallback` scenario types.
- `scripts/run-ai-dev-benchmark-fixtures.js` owns deterministic manifest/path validation, `VALID_SCENARIO_TYPES`, fixture result generation, and result schema validation.
- `tests/unit/ai-dev-benchmark-fixtures.test.js` currently asserts exactly three checked-in fixtures and uses `api-contract` as an invalid unknown scenario test; that test must be changed when `api-contract` becomes valid.
- `scripts/run-ai-dev-quality-gate.js` already aggregates benchmark fixture output as advisory and surfaces benchmark failures in `advisory_failures[]`.
- `README.md`, `README.zh-CN.md`, and `docs/catalog/runtime-capabilities.md` already state benchmark fixtures validate advisory evidence shape, not LLM semantic quality.
- Existing fixture shape under `tests/fixtures/ai-dev-benchmarks/*/` is small and repo-like: each fixture has `manifest.json`, `prompt.md`, and `repo/`.

### Institutional Learnings

- `docs/solutions/workflow-issues/modify-source-not-artifacts-2026-04-13.md` reinforces source-first fixes and avoiding generated runtime edits.
- `docs/solutions/workflow-issues/self-reflection-cud-contract-loop-2026-05-05.md` reinforces keeping review/evidence fields advisory and human-readable instead of creating central state machines.
- `docs/solutions/workflow-issues/doc-review-codex-multi-agent-dispatch-boundary-2026-05-05.md` reinforces explicit degraded/fallback reporting when workflow-owned review dispatch is unavailable or limited.

### External References

- No external research was used. This is a repo-local benchmark/evidence closure plan based on existing source, tests, and P2 backlog.

---

## Key Technical Decisions

- Add exactly two scenario types: `api-contract` and `multi-module-refactor`. Rationale: they cover the two remaining high-value risks named by the P2 backlog without expanding into a broad benchmark catalog.
- Represent semantic closure as an optional manifest-level `semantic_review` evidence object, not as an `expected_artifacts` item. Rationale: expected artifacts describe workflow outputs; semantic review is benchmark evidence about those outputs.
- Validate `semantic_review.artifact_path` existence when the object is present. Rationale: committed semantic review evidence must be directly inspectable, while most `expected_artifacts` remain desired workflow outputs that may not pre-exist.
- Keep benchmark gate advisory. Rationale: fixture drift is useful review signal, but the project has not established enough semantic evidence to make it release-blocking.
- Update result `artifact_paths` to include committed semantic review evidence paths. Rationale: downstream gate/release reviewers need a direct evidence pointer without parsing every manifest.

---

## Open Questions

### Resolved During Planning

- Should full closure add many fixtures? Resolved: no. Add exactly `api-contract` and `multi-module-refactor`.
- Should runner execute real workflows? Resolved: no. Runner remains deterministic and read-only.
- Should semantic evidence be a score? Resolved: no. It is a human-readable artifact, not a score or pass-rate system.

### Deferred to Implementation

- Exact fixture file names and minimal repo contents: implementer can adjust as long as the fixture exposes API contract and module-scope risks clearly.
- Which fixture carries the semantic review evidence: prefer `api-contract` because response shape drift is easy to review, but implementation may choose `multi-module-refactor` if it gives clearer evidence.
- Whether README changes are needed beyond existing benchmark wording: update only if current one-line visibility becomes stale after fixture count and semantic-review evidence are added.

---

## Output Structure

    tests/
      fixtures/
        ai-dev-benchmarks/
          api-contract/
            manifest.json
            prompt.md
            expected/
              semantic-review.md
            repo/
          multi-module-refactor/
            manifest.json
            prompt.md
            repo/

---

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```text
manifest.json
  scenario_type: api-contract | multi-module-refactor
  semantic_review?
    artifact_path: expected/semantic-review.md
    review_mode: llm-review-pass | workflow-output-review
    status: recorded
  expected_artifacts[]
    kind: doc | test | workflow-summary | quality-gate-result

runner
  read manifest
  validate schema and safe paths
  validate fixture id and scenario type
  validate semantic_review artifact exists when declared
  emit benchmark-fixtures-result.json with advisory fixture result
  include semantic_review evidence path in fixture artifact_paths

quality gate
  aggregate benchmark result as advisory
  preserve advisory_failures[]
  do not change gate-level passed semantics
```

---

## Implementation Units

### U1. Extend benchmark fixture contract for full-closure scenarios

**Goal:** Let the schema and runner recognize the two new full-closure scenario types and optional semantic review evidence.

**Requirements:** R1, R4, R5, R6, R8

**Dependencies:** None

**Files:**
- Modify: `docs/contracts/quality-gates/ai-dev-benchmark-fixture.schema.json`
- Modify: `docs/contracts/quality-gates/ai-dev-benchmark-fixtures-result.schema.json`
- Modify: `scripts/run-ai-dev-benchmark-fixtures.js`
- Test: `tests/unit/ai-dev-benchmark-fixtures.test.js`

**Approach:**
- Add `api-contract` and `multi-module-refactor` to the manifest schema `scenario_type` enum and runner `VALID_SCENARIO_TYPES`.
- Add optional `semantic_review` object to the manifest schema with:
  - `artifact_path`: safe fixture-relative evidence file path,
  - `review_mode`: a small enum such as `llm-review-pass` or `workflow-output-review`,
  - `status`: `recorded`.
- Keep `validation_commands_status: declared_only`; do not introduce executed validation semantics.
- Add deterministic runner logic that, when `semantic_review` is present, requires `semantic_review.artifact_path` to exist as a file under the fixture directory and includes it in the fixture result `artifact_paths`.
- Do not require every expected artifact to exist. Existing expected artifacts describe desired workflow outputs; only committed semantic review evidence needs existence validation.

**Patterns to follow:**
- `scripts/run-ai-dev-benchmark-fixtures.js` `isSafeRepoRelativePath()` and `validateFixture()`.
- `tests/unit/ai-dev-benchmark-fixtures.test.js` invalid path and unknown scenario tests.
- `docs/contracts/quality-gates/ai-dev-benchmark-fixtures-result.schema.json` current light result shape.

**Test scenarios:**
- Happy path: a temp fixture with `scenario_type: "api-contract"` validates as a known scenario.
- Happy path: a temp fixture with `scenario_type: "multi-module-refactor"` validates as a known scenario.
- Happy path: a fixture with `semantic_review.artifact_path` and an existing file passes and includes the review file in `artifact_paths`.
- Error path: a fixture with a missing `semantic_review.artifact_path` fails with a stable reason code such as `missing-semantic-review-artifact`.
- Error path: an unsupported scenario type still fails, using a name other than `api-contract`.
- Integration: result schema accepts artifact paths that include semantic review evidence without changing advisory semantics.

**Verification:**
- Unit tests prove new enum values, semantic review artifact handling, and result schema compatibility.

---

### U2. Add API contract benchmark fixture

**Goal:** Add a repo-like fixture that exercises API response shape, consumer expectation, contract doc, targeted test, and changelog alignment.

**Requirements:** R1, R2, R8

**Dependencies:** U1

**Files:**
- Create: `tests/fixtures/ai-dev-benchmarks/api-contract/manifest.json`
- Create: `tests/fixtures/ai-dev-benchmarks/api-contract/prompt.md`
- Create: `tests/fixtures/ai-dev-benchmarks/api-contract/repo/src/api/grants.js`
- Create: `tests/fixtures/ai-dev-benchmarks/api-contract/repo/src/client/grants-client.js`
- Create: `tests/fixtures/ai-dev-benchmarks/api-contract/repo/tests/unit/grants-api.test.js`
- Create: `tests/fixtures/ai-dev-benchmarks/api-contract/repo/docs/contracts/grants-api.md`
- Create: `tests/fixtures/ai-dev-benchmarks/api-contract/repo/CHANGELOG.md`
- Test: `tests/unit/ai-dev-benchmark-fixtures.test.js`

**Approach:**
- Keep the fixture small and dependency-free. The repo snapshot should be readable without installing packages.
- Prompt should request a bounded API contract change, for example adding a response field that must be reflected in handler, consumer expectations, contract docs, tests, and changelog.
- `expected_changed_paths` should name only the API handler, consumer/test contract surface, docs contract, and changelog.
- `quality_signals` should emphasize response shape consistency, consumer alignment, targeted test coverage, and no unrelated API expansion.

**Patterns to follow:**
- `tests/fixtures/ai-dev-benchmarks/cli-bugfix/` for code/test fixture shape.
- `tests/fixtures/ai-dev-benchmarks/docs-only/` for docs/changelog boundary.

**Test scenarios:**
- Happy path: checked-in fixture manifests include `api-contract`.
- Happy path: API fixture prompt, repo path, expected changed paths, expected artifacts, and validation commands are safe repo-relative paths.
- Integration: runner reports `api-contract` as passed when all deterministic fixture evidence exists.

**Verification:**
- Benchmark fixture unit tests list five checked-in fixtures and include `api-contract` as a valid fixture.

---

### U3. Add multi-module refactor benchmark fixture

**Goal:** Add a repo-like fixture that exercises module scope boundaries and prevents benchmark planning from assuming whole-repo edits are acceptable.

**Requirements:** R1, R3, R8

**Dependencies:** U1

**Files:**
- Create: `tests/fixtures/ai-dev-benchmarks/multi-module-refactor/manifest.json`
- Create: `tests/fixtures/ai-dev-benchmarks/multi-module-refactor/prompt.md`
- Create: `tests/fixtures/ai-dev-benchmarks/multi-module-refactor/repo/packages/cli/src/render.js`
- Create: `tests/fixtures/ai-dev-benchmarks/multi-module-refactor/repo/packages/cli/tests/render.test.js`
- Create: `tests/fixtures/ai-dev-benchmarks/multi-module-refactor/repo/packages/web/src/render.js`
- Create: `tests/fixtures/ai-dev-benchmarks/multi-module-refactor/repo/packages/shared/src/format.js`
- Create: `tests/fixtures/ai-dev-benchmarks/multi-module-refactor/repo/CHANGELOG.md`
- Test: `tests/unit/ai-dev-benchmark-fixtures.test.js`

**Approach:**
- Fixture repo should have at least two modules with similar naming so scope expansion would be tempting and reviewable.
- Prompt should explicitly target one module, such as `packages/cli`, while mentioning sibling modules only as context.
- `expected_changed_paths` should exclude sibling module files unless they are intentionally shared dependencies.
- `quality_signals` should state that advisory module hints are not hard gates, but scope must be justified by prompt/source plan and expected paths.

**Patterns to follow:**
- `docs/2026-05-10/spec-first-full-code-review-and-competitor-benchmark.md` P2-001 deferred module-boundary discussion.
- `tests/fixtures/ai-dev-benchmarks/graph-degraded-fallback/` for fixture prompts that test evidence boundaries rather than runtime execution.

**Test scenarios:**
- Happy path: checked-in fixture manifests include `multi-module-refactor`.
- Happy path: runner validates the multi-module fixture without requiring sibling module changes.
- Edge case: fixture quality signals mention target module scope and no unrelated module edits.

**Verification:**
- Benchmark fixture unit tests prove the full checked-in fixture list is exactly the intended five entries.

---

### U4. Add semantic review evidence for one fixture

**Goal:** Record one real semantic review pass so full closure is not limited to deterministic schema/path validation.

**Requirements:** R4, R5, R6, R8, R9

**Dependencies:** U1, U2 or U3

**Files:**
- Create: `tests/fixtures/ai-dev-benchmarks/api-contract/expected/semantic-review.md`
- Modify: `tests/fixtures/ai-dev-benchmarks/api-contract/manifest.json`
- Test: `tests/unit/ai-dev-benchmark-fixtures.test.js`

**Approach:**
- Prefer the API contract fixture for semantic review because response shape drift is easy to inspect.
- The semantic review document must state:
  - fixture id and prompt under review,
  - whether the review inspected expected fixture output, an actual workflow output, or a bounded LLM-review pass,
  - checklist items for expected changed paths, contract alignment, tests, changelog, and no scope expansion,
  - result and limitations.
- Do not claim that `$spec-work` executed unless it actually did during implementation.
- Add the semantic review document through the manifest-level `semantic_review` object so the runner can link it as evidence without confusing it with workflow expected outputs.

**Patterns to follow:**
- `docs/examples/standards-glue-consumption-examples.md` style: human-readable examples, not machine-readable state.
- `docs/catalog/runtime-capabilities.md` boundary language for deterministic facts vs LLM judgment.

**Test scenarios:**
- Happy path: runner includes the semantic review file in fixture `artifact_paths`.
- Error path: deleting or mispointing the semantic review artifact in a temp fixture produces a stable failure.
- Integration: semantic review evidence does not change `validation_commands_status` from `declared_only`.

**Verification:**
- Unit tests prove semantic evidence is visible but not treated as a score or executed validation.

---

### U5. Keep quality gate advisory and update documentation/status

**Goal:** Update downstream visibility so reviewers know full closure v1 exists without mistaking it for a benchmark platform or release gate.

**Requirements:** R7, R8, R9, R10

**Dependencies:** U1, U2, U3, U4

**Files:**
- Modify: `tests/unit/ai-dev-quality-gate.test.js`
- Modify: `docs/catalog/runtime-capabilities.md`
- Modify: `docs/2026-05-10/spec-first-full-code-review-and-competitor-benchmark.md`
- Modify: `README.md`
- Modify: `README.zh-CN.md`
- Modify: `CHANGELOG.md`

**Approach:**
- Update tests so `buildBenchmarkFixturesCheck()` and advisory aggregation remain non-blocking with five fixtures and semantic-review evidence.
- Update runtime capability catalog to say the suite now includes five fixtures plus one semantic review evidence artifact, while still validating deterministic contracts only.
- Update the benchmark/review report so `P2-003` becomes `full closure v1 fixed` and the top-level P2 count no longer says the full closure is pending.
- README/zh-CN should stay compact. If changed, add only one phrase noting semantic review evidence exists; do not add product marketing copy.
- Add a changelog entry using the current `leokuang` author format.

**Patterns to follow:**
- `tests/unit/ai-dev-quality-gate.test.js` advisory benchmark failure tests.
- Existing `P2-002`, `P2-004`, `P2-007`, and `P2-009` status language in the benchmark/review report.
- Current single-line `CHANGELOG.md` format.

**Test scenarios:**
- Happy path: `test:ai-dev:benchmarks` reports five fixtures and no failures.
- Happy path: `test:ai-dev:gate` remains passed when only advisory benchmark checks fail in synthetic test data.
- Integration: benchmark report and runtime catalog keep the no-score/no-hard-gate boundary.
- Regression: changelog format test passes.

**Verification:**
- Targeted unit and gate checks prove fixture, runner, quality gate, docs contract, and changelog alignment.

---

## System-Wide Impact

- **Interaction graph:** `scripts/run-ai-dev-benchmark-fixtures.js` remains the deterministic fixture validator; `scripts/run-ai-dev-quality-gate.js` remains the advisory aggregator; LLM/reviewer remains responsible for semantic judgment.
- **Error propagation:** Invalid fixture schema/path/evidence causes `test:ai-dev:benchmarks` to fail; when aggregated into `test:ai-dev:gate`, benchmark failures remain visible in `advisory_failures[]` and do not block gate-level `passed`.
- **State lifecycle risks:** No new durable runtime state. Checked-in fixtures and semantic review evidence live under `tests/fixtures/`; command outputs remain under `.spec-first/workflows/quality-gates/` and are not committed.
- **API surface parity:** Manifest schema and result schema are the only machine-readable contract changes. No CLI command behavior changes beyond existing npm script outputs reflecting more fixtures.
- **Integration coverage:** Unit tests cover fixture schema, runner behavior, result schema, quality gate advisory aggregation, and documentation/changelog contracts.
- **Unchanged invariants:** Benchmark runner does not execute agents, does not score LLM output, does not create release hard gates, and does not replace `spec-code-review` or human judgment.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Semantic review evidence is mistaken for automated scoring | Name it `semantic-review`, document it as human/LLM evidence, and avoid score/pass-rate fields. |
| Runner starts becoming a hidden workflow engine | Keep runner read-only and deterministic; only validate paths/schema/evidence existence. |
| Fixture suite grows into a benchmark catalog | Add exactly two fixtures for full closure; defer additional scenarios to future explicit plans. |
| Advisory failures are ignored | Preserve `advisory_failures[]` and include semantic review evidence paths in result artifacts. |
| API/multi-module fixture repos become too large | Keep snapshots minimal and dependency-free; no npm install requirement inside fixtures. |
| Top-level report status drifts again | Update benchmark/review document and tests together, and keep changelog aligned. |

---

## Documentation / Operational Notes

- This is user-visible quality evidence work.
- Runtime regeneration is not required because source workflow assets are not changed unless implementation expands README/docs only.
- No generated `.spec-first/workflows/quality-gates/*` output should be committed.
- After implementation, run `$spec-code-review` before committing because this touches schemas, runner behavior, tests, docs, and release-quality evidence.

---

## Sources & References

- **Origin document:** `docs/2026-05-10/spec-first-full-code-review-and-competitor-benchmark.md`
- Prior P2-003 plan: `docs/plans/2026-05-11-003-feat-ai-dev-benchmark-fixtures-plan.md`
- Fixture schema: `docs/contracts/quality-gates/ai-dev-benchmark-fixture.schema.json`
- Result schema: `docs/contracts/quality-gates/ai-dev-benchmark-fixtures-result.schema.json`
- Runner: `scripts/run-ai-dev-benchmark-fixtures.js`
- Quality gate: `scripts/run-ai-dev-quality-gate.js`
- Tests: `tests/unit/ai-dev-benchmark-fixtures.test.js`, `tests/unit/ai-dev-quality-gate.test.js`
- Existing fixtures: `tests/fixtures/ai-dev-benchmarks/`
