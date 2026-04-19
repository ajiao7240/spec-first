---
name: work-beta-workflow
description: "[BETA] Execute work plans with external delegate support. Same as spec:work but includes experimental Codex delegation mode for token-conserving code implementation."
disable-model-invocation: true
argument-hint: "[plan file, specification, or todo file path] [delegate:codex]"
---

# Work Plan Execution Command

Execute a work plan efficiently while maintaining quality and finishing features.

## Introduction

This command takes a work document (plan, specification, or todo file) and executes it systematically. The focus is on **shipping complete features** by understanding requirements quickly, following existing patterns, and maintaining quality throughout.

If you have a feature idea or rough description rather than a document, run `/spec:plan` first to produce one — then come back here to execute it. `spec:work-beta` is plan-driven and does not accept bare prompts.
If the task is experiment-driven optimization against a stable measurement harness rather than feature delivery, route to `spec-optimize` instead of forcing it through `spec:work-beta`.

**Beta rollout note:** Invoke `spec:work-beta` manually when you want to trial Codex delegation. During the beta period, planning and workflow handoffs remain pointed at stable `spec:work` to avoid dual-path orchestration complexity.

## Input Document

<input_document> #$ARGUMENTS </input_document>

## Stage-0 上下文预载（可选增强，不阻断主工作流）

> 此步骤读取 `spec-graph-bootstrap` 生成的 Stage-0 产物作为增强上下文。
> 优先以 evaluator 输出 contract 为真源；任何文件缺失、JSON 解析失败、目录不存在均只触发降级，不中止主工作流。

**本 workflow stage 标识**：`work`

**Contract note:** `spec:work-beta` 当前有意复用 stable `work` Stage-0 产物与 telemetry 口径。不要把这里改成 `work-beta`，除非 bootstrap evaluator、asset naming、以及下游消费方在同一变更里一起更新并重新验证。

### 预载步骤

1. **解析 slug**
   - 取当前仓库根目录名：`slug = basename(git rev-parse --show-toplevel)`
   - context 路径：`docs/contexts/<slug>/`
   - 若命令失败或路径不存在 → 跳过整个预载步骤（Level 3）

2. **读取 control plane contract**
   - 控制面路径：`.spec-first/workflows/bootstrap/<slug>/`
   - 优先读取 `context-routing.json` 与 `artifact-manifest.json`
   - 若存在 `minimal-context/work.json`，视为最高优先级 machine context
   - 任一关键 contract 缺失或解析失败 → 进入 Level 2 降级

3. **按 evaluator 输出 contract 组织上下文**
   - 优先以 `selection_subject / selected_contexts` 作为 Stage-0 的解释型真源，回答“命中了谁、为什么命中、当前上下文边界是什么”
   - `selected_assets / fallback_reason / level / skipped_rules` 保留为 compatibility view；它们必须由解释层单向派生，不再反向决定命中主体
   - `work` 场景优先读取：
     - `minimal-context/work.json`
     - `code-facts/test-map.md`
     - `context-packs/review-change.md`
   - `injection-index.yaml` 仅作为人类视图，不再是运行时唯一判定逻辑
   - 若 runtime 输出 `selection_subject.kind = workspace`，仅把它视为 overview / unresolved fallback，不要把 workspace 当成常规 `L0` 执行主体
   - 若 `minimal-context/work.json` 提供 `platform_focus`、`required_verifications` 或 `optional_verifications`，将其视为 repo 级 verification summary baseline
   - 若当前 runtime `verification_summary` 还提供 `source / required_verifications / optional_verifications / recommended_required_verifications / recommended_optional_verifications / repo_required_verifications / repo_optional_verifications`，则以 `required_verifications / optional_verifications` 作为本次运行的 effective checklist；若同时提供顶层 `verifier_dispatch`，则把 `verifier_dispatch.handoff_posture / dispatch_candidates / manual_required_verifications / dispatch_blockers` 视为“候选 verifier + blocker”输入，而不是固定执行树
   - 若 `verification_summary.source === 'change-surface'`，即使 `required_verifications` 为空，也不要把 `repo_required_verifications / repo_optional_verifications` 回填成当前改动的必跑项；这些字段只用于了解仓库级 baseline
   - 若当前 runtime 还提供 `ai_dev_quality_gate_result.passed / checks / failures / artifact_path`，则把它视为最近一次 CI/gate 的事实快照；它只回答“最近 gate 发生了什么”，不回答“这次任务必须怎么流转”
   - 若当前 runtime 还提供 `verification_evidence.evidence_items`，则把它当成独立证据引用清单；它只回答“已有何种证据、来自哪个 verifier、落在哪”，不回答执行编排
   - 若当前 runtime 还提供 `verification_gate_state.overall_status / required_gates / optional_evidence / blockers / ci_gate`，则用它区分 `pending / blocked / satisfied / not-needed`，不要把它解释成“已经自动完成验证”；只有挂上真实 evidence reference 时，`satisfied` 才成立
   - **Runtime Stage-0 context（best-effort, pre-resolved JSON）**
!`repo=$(git rev-parse --show-toplevel 2>/dev/null || pwd); if command -v spec-first >/dev/null 2>&1 && spec-first stage0-context --stage work --workflow spec-work-beta --format json 2>/dev/null; then true; elif [ -f "$repo/bin/spec-first.js" ] && node "$repo/bin/spec-first.js" stage0-context --stage work --workflow spec-work-beta --format json 2>/dev/null; then true; elif [ -f "$repo/node_modules/spec-first/bin/spec-first.js" ] && node "$repo/node_modules/spec-first/bin/spec-first.js" stage0-context --stage work --workflow spec-work-beta --format json 2>/dev/null; then true; else echo '__SPEC_FIRST_STAGE0_CONTEXT_UNAVAILABLE__'; fi`
   - 若输出为 `__SPEC_FIRST_STAGE0_CONTEXT_UNAVAILABLE__`，说明 runtime helper 当前不可用；继续按上面的 control plane contract 手工预载，不阻断主任务
   - 每个文件：存在则读取，缺失则跳过（Level 1）
   - 默认写一条 Stage-0 telemetry，至少记录 `stage / profile / selection_subject / selected_contexts / selected_assets / fallback_reason / skipped_rules`

4. **Level 2 固定最小集合**（control plane contract 不可用时）
   - `docs/contexts/<slug>/00-summary.md`
   - `docs/contexts/<slug>/pitfalls/index.md`
   - `docs/contexts/<slug>/code-facts/public-entrypoints.md`
   - `docs/contexts/<slug>/code-facts/test-map.md`

5. **降级说明**
   - 触发降级时，在响应中一句话说明原因
   - 不要求用户先补 bootstrap 产物，主任务继续执行

6. **workspace v1 边界**
   - 默认仍按单仓 Stage-0 消费，不改变现有 selected assets 顺序
   - 若 runtime 已解析出 workspace / module / nested topology，以 `selection_subject / selected_contexts` 为准，不再把 repo-only 路径假设当成唯一语义
   - 只有显式提供 `repoRoots` 时，才进入 workspace 聚合路径

### Reload Before Act

Treat freshness and fallback as trust-shaping inputs, not as blockers:

- `L0` and non-stale context: consume Stage-0 directly; no forced reload before editing
- `L1` with `freshness_stale`: before editing and again before claiming done, re-read the current plan or requirements source plus the most relevant `selected_assets`
- `L2`: treat Stage-0 as degraded context; re-read the local plan, the touched behavior slice, and the most relevant code facts before continuing
- `L3` or runtime helper unavailable: continue, but state that bootstrap context is unavailable and rely on direct repo reads

Reload priority should be:
1. The current user-provided or explicitly referenced plan / requirements document
2. Stage-0 `selected_assets`
3. The current diff surface or implementation files
4. Broader repo context only if still needed

Do not block execution solely because context is stale or partial. Do not present `freshness_stale` as `L0`.

## Argument Parsing

Parse `$ARGUMENTS` for the following optional tokens. Strip each recognized token before interpreting the remainder as the plan file path.

| Token | Example | Effect |
|-------|---------|--------|
| `delegate:codex` | `delegate:codex` | Activate Codex delegation mode for plan execution |
| `delegate:local` | `delegate:local` | Deactivate delegation even if enabled in config |

All tokens are optional. When absent, fall back to the resolution chain below.

**Fuzzy activation:** Also recognize imperative delegation-intent phrases such as "use codex", "delegate to codex", "codex mode", or "delegate mode" as equivalent to `delegate:codex`. A bare mention of "codex" in a prompt must NOT activate delegation -- only clear delegation intent triggers it.

**Fuzzy deactivation:** Also recognize phrases such as "no codex", "local mode", "standard mode" as equivalent to `delegate:local`.

### Settings Resolution Chain

After extracting tokens from arguments, resolve the delegation state using this precedence chain:

1. **Argument flag** -- `delegate:codex` or `delegate:local` from the current invocation (highest priority)
2. **Config file** -- extract settings from the config block below. Value `codex` for `work_delegate` activates delegation; `false` deactivates.
3. **Hard default** -- `false` (delegation off)

**Config (pre-resolved):**
!`cat "$(git rev-parse --show-toplevel 2>/dev/null)/.spec-first/config.local.yaml" 2>/dev/null || cat "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null)")/.spec-first/config.local.yaml" 2>/dev/null || echo '__NO_CONFIG__'`

If the block above contains YAML key-value pairs, extract values for the keys listed below.
If it shows `__NO_CONFIG__`, the file does not exist -- all settings fall through to defaults.
If it shows an unresolved command string, read `.spec-first/config.local.yaml` from the repo root using the native file-read tool. If the file does not exist, all settings fall through to defaults.

If any setting has an unrecognized value, fall through to the hard default for that setting.

Config keys:
- `work_delegate` -- `codex` or default `false`
- `work_delegate_consent` -- `true` or default `false`
- `work_delegate_sandbox` -- `yolo` (default) or `full-auto`
- `work_delegate_decision` -- `auto` (default) or `ask`
- `work_delegate_model` -- Codex model to use (default `gpt-5.4`)
- `work_delegate_effort` -- `minimal`, `low`, `medium`, `high` (default), or `xhigh`

Store the resolved state for downstream consumption:
- `delegation_active` -- boolean, whether delegation mode is on
- `delegation_source` -- `argument` or `config` or `default`
- `sandbox_mode` -- `yolo` or `full-auto`
- `consent_granted` -- boolean
- `delegate_model` -- string
- `delegate_effort` -- string

## Execution Workflow

### Phase 1: Quick Start

1. **Read Plan and Clarify**

   - Read the work document completely
   - Treat the plan as a decision artifact, not an execution script
   - If the plan includes sections such as `Implementation Units`, `Work Breakdown`, `Requirements Trace`, `Files`, `Test Scenarios`, or `Verification`, use those as the primary source material for execution
   - Check for `Execution note` on each implementation unit — these carry the plan's execution posture signal for that unit (for example, test-first or characterization-first). Note them when creating tasks.
   - Treat the exact string `Execution target: external-delegate` as the canonical delegation signal. Do not infer delegation from synonyms, paraphrases, or case variants in this workflow.
   - Record any implementation unit carrying that exact signal as a `delegation candidate` so the later routing decision is explicit and reviewable.
   - Check for a `Deferred to Implementation` or `Implementation-Time Unknowns` section — these are questions the planner intentionally left for you to resolve during execution. Note them before starting so they inform your approach rather than surprising you mid-task
   - Check for a `Scope Boundaries` section — these are explicit non-goals. Refer back to them if implementation starts pulling you toward adjacent work
   - Identify the allowed change surface before editing — the files, call sites, and behavior slices that belong to the current task. Derive it from the plan's `Files` / `Scope Boundaries` / `Implementation Units` first; fill in gaps explicitly.
   - Every changed line must trace to a plan implementation unit, task, or the current user request. If a change has no such trace, stop and reclassify it as a separate follow-up.
   - If multiple materially different approaches exist, state the tradeoffs before proceeding. (Materially different = different behavior contract, API shape, data structure, or error semantics; naming or ordering variations do not trigger this.)
   - Review any references or links provided in the plan
   - If Stage-0 runtime `verification_summary` provides `required_verifications`, record `required_verifications / optional_verifications` as the default verification checklist for this run before editing files
   - If `verification_summary.source === 'change-surface'`, treat empty effective verification lists as a valid outcome for this diff and keep `repo_required_verifications / repo_optional_verifications` as background baseline only
   - If top-level `verifier_dispatch` exists, treat `dispatch_candidates` as verifier options, `manual_required_verifications` as non-registry gates that still need handling, and `dispatch_blockers` as real blockers to surface before claiming coverage
   - If `ai_dev_quality_gate_result` exists, treat it as the latest passive CI/gate snapshot only; it can inform judgment, but it must not be treated as a workflow state machine or an auto-blocking orchestration rule
   - If `verification_evidence` exists, treat `evidence_items` as factual proof references only; they record verifier/output/artifact links, not dispatch instructions
   - If `verification_gate_state` exists, use `overall_status / required_gates / blockers` to keep an explicit pending-vs-blocked-or-satisfied verification ledger during execution; it is status input, not an auto-dispatch contract
   - Translate the plan's `Verification` into the run's `Verification-as-Done`. Do not invent a second done contract.
   - If the user explicitly asks for TDD, test-first, or characterization-first execution in this session, honor that request even if the plan has no `Execution note`
   - Determine mode from caller posture only: `interactive` is the default. Only an explicit caller contract that forbids user interaction makes the run `non-interactive`. `pipeline` and `headless` are examples of `non-interactive` posture, not separate mode enums.
   - Never infer `non-interactive` from CI environment variables, branch names, or user silence.
   - Before execution, prepare a short pre-execution checkpoint covering:
     - `Restated Understanding`
     - `Current Core Goal`
     - `Scope / Non-goals`
     - `Verification-as-Done`
   - If anything is unclear or ambiguous in a way that blocks safe execution, ask clarifying questions before editing.
   - In `interactive` mode, present the checkpoint and ask for approval in the same pre-execution block. Do not split checkpoint and approval into separate pauses.
   - In `non-interactive` mode, do not wait for approval. Carry the same checkpoint facts into task setup and final reporting, then proceed.
   - **Do not skip this calibration** - better to align once up front than drift through the implementation.

2. **Setup Environment**

   First, check the current branch:

   ```bash
   current_branch=$(git branch --show-current)
   default_branch=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@')

   # Fallback if remote HEAD isn't set
   if [ -z "$default_branch" ]; then
     default_branch=$(git rev-parse --verify origin/main >/dev/null 2>&1 && echo "main" || echo "master")
   fi
   ```

   **If already on a feature branch** (not the default branch):
   - Ask: "Continue working on `[current_branch]`, or create a new branch?"
   - If continuing, proceed to step 3
   - If creating new, follow Option A or B below

   **If on the default branch**, choose how to proceed:

   **Option A: Create a new branch**
   ```bash
   git pull origin [default_branch]
   git checkout -b feature-branch-name
   ```
   Use a meaningful name based on the work (e.g., `feat/user-authentication`, `fix/email-validation`).

   **Option B: Use a worktree (recommended for parallel development)**
   ```bash
   skill: git-worktree
   # The skill will create a new branch from the default branch in an isolated worktree
   ```

   **Option C: Continue on the default branch**
   - Requires explicit user confirmation
   - Only proceed after user explicitly says "yes, commit to [default_branch]"
   - Never commit directly to the default branch without explicit permission

   **Recommendation**: Use worktree if:
   - You want to work on multiple features simultaneously
   - You want to keep the default branch clean while experimenting
   - You plan to switch between branches frequently

3. **Create Todo List**
   - Use your available task tracking tool (e.g., TodoWrite, task lists) to break the plan into actionable tasks
   - Derive tasks from the plan's implementation units, dependencies, files, test targets, and verification criteria
   - Carry each unit's `Execution note` into the task when present
   - When a unit carries the canonical `Execution target: external-delegate` signal, tag the corresponding task(s) as `delegation candidate` work so later routing is deterministic
   - For each unit, read the `Patterns to follow` field before implementing — these point to specific files or conventions to mirror
   - Use each unit's `Verification` field as the primary "done" signal for that task
   - Do not expect the plan to contain implementation code, micro-step TDD instructions, or exact shell commands
   - Include dependencies between tasks
   - Prioritize based on what needs to be done first
   - Include testing and quality check tasks
   - Keep tasks specific and completable

4. **Choose Execution Strategy**

   Before choosing a strategy, resolve `delegation_scope` for this invocation:

   | State | Routing rule |
   |------|--------------|
   | `delegation_active = false` and no `delegation candidate` units | Set `delegation_scope = none` and use the standard strategy table below |
   | `delegation_active = false` and one or more `delegation candidate` units | Ask once whether to temporarily enable Codex delegation for those candidate units only in this session. If the user declines, set `delegation_scope = none`. If the user accepts, set `delegation_scope = candidate-only`. Do not write that temporary choice to `.spec-first/config.local.yaml`. |
   | `delegation_active = true` and one or more `delegation candidate` units | Set `delegation_scope = candidate-only` by default. Only tasks belonging to candidate units enter the delegated path; non-candidate tasks continue through the local strategy table below. If the user explicitly asks for full-plan delegation, set `delegation_scope = full-plan`. |
   | `delegation_active = true` and no `delegation candidate` units | Set `delegation_scope = full-plan` and keep the existing argument/config-selected delegation behavior |

   **Delegation routing gate:** If `delegation_scope` is `candidate-only` or `full-plan`, read `references/codex-delegation-workflow.md` and follow its Pre-Delegation Checks and Delegation Decision flow. If all checks pass and delegation proceeds, force **serial execution** for the delegated portion and proceed directly to Phase 2 using the workflow's batched execution loop. If any check disables delegation, set `delegation_scope = none` and fall through to the standard strategy table below.

   After creating the task list, decide how to execute based on the plan's size and dependency structure:

   | Strategy | When to use |
   |----------|-------------|
   | **Inline** | 1-2 small tasks, or tasks needing user interaction mid-flight |
   | **Serial subagents** | 3+ tasks with dependencies between them. Each subagent gets a fresh context window focused on one unit — prevents context degradation across many tasks |
   | **Parallel subagents** | 3+ tasks where some units have no shared dependencies and touch non-overlapping files. Dispatch independent units simultaneously, run dependent units after their prerequisites complete |

   **Subagent dispatch** uses your available subagent or task spawning mechanism. For each unit, give the subagent:
   - The full plan file path (for overall context)
   - The specific unit's Goal, Files, Approach, Execution note, Patterns, Test scenarios, and Verification
   - Any resolved deferred questions relevant to that unit
   - Instruction to check whether the unit's test scenarios cover all applicable categories (happy paths, edge cases, error paths, integration) and supplement gaps before writing tests

   **Permission mode:** Omit the `mode` parameter when dispatching subagents so the user's configured permission settings apply. Do not pass `mode: "auto"` — it overrides user-level settings like `bypassPermissions`.

   After each subagent completes, update the plan checkboxes and task list before dispatching the next dependent unit.

   For genuinely large plans needing persistent inter-agent communication (agents challenging each other's approaches, shared coordination across 10+ tasks), see Swarm Mode below which uses Agent Teams.

### Phase 2: Execute

1. **Task Execution Loop**

   For each task in priority order:

   ```
   while (tasks remain):
     - Mark task as in-progress
     - Read any referenced files from the plan
     - Look for similar patterns in codebase
     - Find existing test files for implementation files being changed (Test Discovery — see below)
     - If `delegation_scope` covers the current task: branch to the Codex Delegation Execution Loop
       (see `references/codex-delegation-workflow.md`)
     - Otherwise: implement following existing conventions
     - Add, update, or remove tests to match implementation changes (see Test Discovery below)
     - Run System-Wide Test Check (see below)
     - Run tests after changes
     - Assess testing coverage: did this task change behavior? If yes, were tests written or updated? If no tests were added, is the justification deliberate (e.g., pure config, no behavioral change)?
     - Mark task as completed
     - Evaluate for incremental commit (see below)
   ```

   When a unit carries an `Execution note`, honor it. For test-first units, write the failing test before implementation for that unit. For characterization-first units, capture existing behavior before changing it. For units without an `Execution note`, proceed pragmatically.

   Guardrails for execution posture:
   - Do not write the test and implementation in the same step when working test-first
   - Do not skip verifying that a new test fails before implementing the fix or feature
   - Do not over-implement beyond the current behavior slice when working test-first
   - Skip test-first discipline for trivial renames, pure configuration, and pure styling work

   Change discipline guardrails:
   - Implement the minimum code the current task requires. Do not add single-use abstractions, unrequested configurability, or speculative guards for failure modes the current task does not justify.
   - Do not bundle opportunistic cleanup into the current change unless it is a direct dependency of the task; explain the reason when you do bundle.
   - Remove imports, variables, or functions your change made orphan (unused as a result of this change). Do not touch pre-existing dead code unless asked.

   **Test Discovery** — Before implementing changes to a file, find its existing test files (search for test/spec files that import, reference, or share naming patterns with the implementation file). When a plan specifies test scenarios or test files, start there, then check for additional test coverage the plan may not have enumerated. Changes to implementation files should be accompanied by corresponding test updates — new tests for new behavior, modified tests for changed behavior, removed or updated tests for deleted behavior.

   **Test Scenario Completeness** — Before writing tests for a feature-bearing unit, check whether the plan's `Test scenarios` cover all categories that apply to this unit. If a category is missing or scenarios are vague (e.g., "validates correctly" without naming inputs and expected outcomes), supplement from the unit's own context before writing tests:

   | Category | When it applies | How to derive if missing |
   |----------|----------------|------------------------|
   | **Happy path** | Always for feature-bearing units | Read the unit's Goal and Approach for core input/output pairs |
   | **Edge cases** | When the unit has meaningful boundaries (inputs, state, concurrency) | Identify boundary values, empty/nil inputs, and concurrent access patterns |
   | **Error/failure paths** | When the unit has failure modes (validation, external calls, permissions) | Enumerate invalid inputs the unit should reject, permission/auth denials it should enforce, and downstream failures it should handle |
   | **Integration** | When the unit crosses layers (callbacks, middleware, multi-service) | Identify the cross-layer chain and write a scenario that exercises it without mocks |

   **System-Wide Test Check** — Before marking a task done, pause and ask:

   | Question | What to do |
   |----------|------------|
   | **What fires when this runs?** Callbacks, middleware, observers, event handlers — trace two levels out from your change. | Read the actual code (not docs) for callbacks on models you touch, middleware in the request chain, `after_*` hooks. |
   | **Do my tests exercise the real chain?** If every dependency is mocked, the test proves your logic works *in isolation* — it says nothing about the interaction. | Write at least one integration test that uses real objects through the full callback/middleware chain. No mocks for the layers that interact. |
   | **Can failure leave orphaned state?** If your code persists state (DB row, cache, file) before calling an external service, what happens when the service fails? Does retry create duplicates? | Trace the failure path with real objects. If state is created before the risky call, test that failure cleans up or that retry is idempotent. |
   | **What other interfaces expose this?** Mixins, DSLs, alternative entry points (Agent vs Chat vs ChatMethods). | Grep for the method/behavior in related classes. If parity is needed, add it now — not as a follow-up. |
   | **Do error strategies align across layers?** Retry middleware + application fallback + framework error handling — do they conflict or create double execution? | List the specific error classes at each layer. Verify your rescue list matches what the lower layer actually raises. |

   **When to skip:** Leaf-node changes with no callbacks, no state persistence, no parallel interfaces. If the change is purely additive (new helper method, new view partial), the check takes 10 seconds and the answer is "nothing fires, skip."

   **When this matters most:** Any change that touches models with callbacks, error handling with fallback/retry, or functionality exposed through multiple interfaces.

2. **Incremental Commits**

   After completing each task, evaluate whether to create an incremental commit:

   | Commit when... | Don't commit when... |
   |----------------|---------------------|
   | Logical unit complete (model, service, component) | Small part of a larger unit |
   | Tests pass + meaningful progress | Tests failing |
   | About to switch contexts (backend → frontend) | Purely scaffolding with no behavior |
   | About to attempt risky/uncertain changes | Would need a "WIP" commit message |

   **Heuristic:** "Can I write a commit message that describes a complete, valuable change? If yes, commit. If the message would be 'WIP' or 'partial X', wait."

   If the plan has Implementation Units, use them as a starting guide for commit boundaries — but adapt based on what you find during implementation. A unit might need multiple commits if it's larger than expected, or small related units might land together. Use each unit's Goal to inform the commit message.

   **Commit workflow:**
   ```bash
   # 1. Verify tests pass (use project's test command)
   # Examples: bin/rails test, npm test, pytest, go test, etc.

   # 2. Stage only files related to this logical unit (not `git add .`)
   git add <files related to this logical unit>

   # 3. Commit with conventional message
   git commit -m "feat(scope): description of this unit"
   ```

   **Handling merge conflicts:** If conflicts arise during rebasing or merging, resolve them immediately. Incremental commits make conflict resolution easier since each commit is small and focused.

   **Note:** Incremental commits use clean conventional messages without attribution footers. The final Phase 4 commit/PR includes the full attribution.

3. **Follow Existing Patterns**

   - The plan should reference similar code - read those files first
   - Match naming conventions exactly
   - Reuse existing components where possible
   - Follow project coding standards (see AGENTS.md; use CLAUDE.md only if the repo still keeps a compatibility shim)
   - When in doubt, grep for similar implementations

4. **Test Continuously**

   - Run relevant tests after each significant change
   - Don't wait until the end to test
   - Fix failures immediately
   - Add new tests for new behavior, update tests for changed behavior, remove tests for deleted behavior
   - **Unit tests with mocks prove logic in isolation. Integration tests with real objects prove the layers work together.** If your change touches callbacks, middleware, or error handling — you need both.

5. **Simplify as You Go**

   After completing a cluster of related implementation units (or every 2-3 units), review recently changed files for simplification opportunities — consolidate duplicated patterns, extract shared helpers, and improve code reuse and efficiency. This is especially valuable when using subagents, since each agent works with isolated context and can't see patterns emerging across units.

   Don't simplify after every single unit — early patterns may look duplicated but diverge intentionally in later units. Wait for a natural phase boundary or when you notice accumulated complexity.

   If a simplify skill or equivalent capability is available, use it. Otherwise, review the changed files yourself for reuse and consolidation opportunities.

   If the current implementation could be noticeably simpler without expanding the task boundary, converge to the simpler version before moving on.

6. **Figma Design Sync** (if applicable)

   For UI work with Figma designs:

   - Implement components following design specs
   - Use figma-design-sync agent iteratively to compare
   - Fix visual differences identified
   - Repeat until implementation matches design

7. **Frontend Design Guidance** (if applicable)

   For UI tasks without a Figma design -- where the implementation touches view, template, component, layout, or page files, creates user-visible routes, or the plan contains explicit UI/frontend/design language:

   - Load the `frontend-design` skill before implementing
   - Follow its detection, guidance, and verification flow
   - If the skill produced a verification screenshot, it satisfies Phase 4's screenshot requirement -- no need to capture separately. If the skill fell back to mental review (no browser access), Phase 4's screenshot capture still applies

8. **Track Progress**
   - Keep the task list updated as you complete tasks
   - Note any blockers or unexpected discoveries
   - Create new tasks if scope expands. When scope expands, classify each new task explicitly as either a `required dependency` (blocks the current task) or a `separate follow-up` (runs in parallel or later). Do not silently expand the current task's boundary.
   - Keep user informed of major milestones

### Phase 3-4: Quality Check and Ship It

When all Phase 2 tasks are complete and execution transitions to quality check, read `references/shipping-workflow.md` for the full shipping workflow: quality checks, code review, final validation, PR creation, and notification.

---

## Codex Delegation Mode

When `delegation_active` is true after argument parsing, read `references/codex-delegation-workflow.md` for the complete delegation workflow: pre-checks, batching, prompt template, execution loop, and result classification.

---

## Swarm Mode with Agent Teams (Optional)

For genuinely large plans where agents need to communicate with each other, challenge approaches, or coordinate across 10+ tasks with persistent specialized roles, use agent team capabilities if available (e.g., Agent Teams in Claude Code, multi-agent workflows in Codex).

**Agent teams are typically experimental and require opt-in.** Do not attempt to use agent teams unless the user explicitly requests swarm mode or agent teams, and the platform supports it.

### When to Use Agent Teams vs Subagents

| Agent Teams | Subagents (standard mode) |
|-------------|---------------------------|
| Agents need to discuss and challenge each other's approaches | Each task is independent — only the result matters |
| Persistent specialized roles (e.g., dedicated tester running continuously) | Workers report back and finish |
| 10+ tasks with complex cross-cutting coordination | 3-8 tasks with clear dependency chains |
| User explicitly requests "swarm mode" or "agent teams" | Default for most plans |

Most plans should use subagent dispatch from standard mode. Agent teams add significant token cost and coordination overhead — use them when the inter-agent communication genuinely improves the outcome.

If the user explicitly wants Claude Code team primitives such as shared inboxes, `Teammate(...)`, or persistent teammates, route to `orchestrating-swarms` rather than inventing that contract inline here. Otherwise stay in standard subagent mode.

### Agent Teams Workflow

1. **Create team** — use your available team creation mechanism
2. **Create task list** — parse Implementation Units into tasks with dependency relationships
3. **Spawn teammates** — assign specialized roles (implementer, tester, reviewer) based on the plan's needs. Give each teammate the plan file path and their specific task assignments
4. **Coordinate** — the lead monitors task completion, reassigns work if someone gets stuck, and spawns additional workers as phases unblock
5. **Cleanup** — shut down all teammates, then clean up the team resources

## Key Principles

### Start Fast, Execute Faster

- Get clarification once at the start, then execute
- Don't wait for perfect understanding - ask questions and move
- The goal is to **finish the feature**, not create perfect process

### The Plan is Your Guide

- Work documents should reference similar code and patterns
- Load those references and follow them
- Don't reinvent - match what exists

### Test As You Go

- Run tests after each change, not at the end
- Fix failures immediately
- Continuous testing prevents big surprises

### Quality is Built In

- Follow existing patterns
- Write tests for new code
- Run linting before pushing
- Review every change — inline for simple additive work, full review for everything else

### Ship Complete Features

- Mark all tasks completed before moving on
- Don't leave features 80% done
- A finished feature that ships beats a perfect feature that doesn't

## When to Use Reviewer Agents

**Don't use by default.** Use reviewer agents only when:

- Large refactor affecting many files (10+)
- Security-sensitive changes (authentication, permissions, data access)
- Performance-critical code paths
- Complex algorithms or business logic
- User explicitly requests thorough review

For most features: Tier 1 inline self-review is sufficient — reserve full `spec-review` (Tier 2) for the high-risk cases above.

## Common Pitfalls to Avoid

- **Analysis paralysis** - Don't overthink, read the plan and execute
- **Skipping clarifying questions** - Ask now, not after building wrong thing
- **Ignoring plan references** - The plan has links for a reason
- **Testing at the end** - Test continuously or suffer later
- **Forgetting to track progress** - Update task status as you go or lose track of what's done
- **80% done syndrome** - Finish the feature, don't move on early
- **Skipping review** - Every change gets reviewed; only the depth varies
