---
generated_at: 2026-05-05T05:50:09+08:00
source_commit: fa49220c2442c86d6082b1480a6641d66000adaa
branch: leo-2026-05-05-update-self
dirty_state: true
reviewed_inputs:
  - docs/10-prompt/自我进化.md
  - docs/10-prompt/结构化项目角色契约.md
  - AGENTS.md
  - CLAUDE.md
  - README.md
  - README.zh-CN.md
  - package.json
  - skills/
  - agents/
  - templates/
  - src/cli/
  - src/cli/contracts/
  - docs/README.md
  - docs/业界分析/
  - docs/solutions/
  - .spec-first/graph/provider-status.json
  - .spec-first/config/runtime-capabilities.json
  - .spec-first/audits/skill-audit/latest/
---

# Composition Baseline

## Repository Structure Discovery

Discovered source roots:

- `README.md`, `README.zh-CN.md`, `CHANGELOG.md`, `package.json`
- `AGENTS.md`, `CLAUDE.md`
- `skills/` with 41 source `SKILL.md` files
- `agents/` with reviewer / specialist source profiles
- `templates/` with Claude hook/rule templates
- `src/cli/`, `src/cli/contracts/`, `src/contracts/`, `src/verification/`
- `docs/`, including current `docs/contracts/`, `docs/solutions/`, `docs/10-prompt/结构化项目角色契约.md`
- `tests/unit/`, `tests/smoke/`, `tests/integration/`, `tests/e2e`-style coverage through npm scripts

Discovered runtime/generated roots:

- `.claude/`
- `.codex/`
- `.agents/skills/`
- `.spec-first/config/`
- `.spec-first/graph/`
- `.spec-first/providers/`
- `.spec-first/impact/`
- `.spec-first/audits/`

Generated runtime roots are evidence sources only. They are not source-of-truth for behavior changes.

## Source / Runtime Boundary Check

The boundary remains mostly healthy:

- `AGENTS.md` and `docs/10-prompt/结构化项目角色契约.md` both state source-first / runtime-generated boundaries.
- `docs/README.md` explicitly marks `docs/业界分析/` as external-reference and historical materials as advisory.
- `.spec-first/*` artifacts contain runtime facts and audit outputs; they are useful evidence but not checked-in source truth.

Current risks:

- `.spec-first/graph/provider-status.json` and `graph-facts.json` lack top-level `source_commit`, `branch`, and `dirty_state`; provider nested `repo_snapshot` points to older commit `dbf9bab...`.
- GitNexus MCP reported the indexed `spec-first` repo is 7 commits behind HEAD, so graph evidence is stale for current source.
- `.spec-first/audits/skill-audit/latest` is a latest pointer but not a fresh repo-wide self-audit.

## Git Freshness Proof

Commands attempted and results:

| Command | Result |
|---|---|
| `git rev-parse HEAD` | `fa49220c2442c86d6082b1480a6641d66000adaa` |
| `git branch --show-current` | `leo-2026-05-05-update-self` |
| `git status --short` | dirty |

Dirty files before report writing:

- `CHANGELOG.md`
- `docs/10-prompt/自我进化.md`

Dirty impact:

- `docs/10-prompt/自我进化.md` is the objective prompt; its frontmatter/body freshness matters.
- `CHANGELOG.md` already had a record for the prompt fix; report creation adds another required changelog record.

## Package Scripts

Discovered from `package.json`:

- `npm run lint:skill-entrypoints`
- `npm run docs:runtime-catalog`
- `npm run typecheck`
- `npm run build`
- `npm run test:mcp-setup`
- `npm run test:graph-bootstrap`
- `npm run test:unit`
- `npm run test:smoke`
- `npm run test:integration`
- `npm run test:ai-dev:gate`
- `npm test`
- `npm run test:jest`
- `npm run test:release`

No `npm run lint` script was discovered.

## Evidence Intake Table

| Evidence input | Discovery path | Required | Discovered | Freshness signal | Status | Nil / empty / error handling | Degradation behavior |
|---|---|---:|---:|---|---|---|---|
| Role contract | `docs/10-prompt/结构化项目角色契约.md` | yes | yes | checked source file | fresh | stop if missing | use as judgment baseline |
| Self-evolution prompt | `docs/10-prompt/自我进化.md` | yes | yes | dirty source file | fresh-with-dirty-note | stop if missing | report dirty influence |
| Host governance | `AGENTS.md`, `CLAUDE.md` | yes | yes | checked source files | fresh | continue with limitation if one missing | source truth over runtime mirrors |
| README / docs index | `README*.md`, `docs/README.md` | yes | yes | checked source files | fresh | continue if partial | use lifecycle labels |
| Skill source contracts | `skills/*/SKILL.md` | yes | yes | source files | fresh | if missing, no skill composition conclusion | source review only, no implied execution |
| Agent profiles | `agents/*.agent.md` | optional | yes | source files | fresh | mark missing if absent | inline lens only, no new agent default |
| Governance contract | `src/cli/contracts/dual-host-governance/skills-governance.json` | yes | yes | source file | fresh | mark governance uncertain | verify counts from JSON shape |
| Graph/provider artifacts | `.spec-first/graph/*`, `.spec-first/providers/*` | optional | yes | generated_at + repo_snapshot | stale/partial | do not infer current readiness | degraded advisory only |
| Skill audit reports | `.spec-first/audits/skill-audit/latest/*` | optional | yes | generated_at 2026-05-03 | stale/partial | do not infer repo-wide health | advisory only |
| Prior system audit | `docs/2026-05-04/project-audit/spec-first-system-audit.md` | optional | yes | report date + old branch | stale advisory | use as historical evidence | do not override current checks |
| Compound knowledge | `docs/solutions/**/*.md` | optional | yes | file dates/frontmatter | mixed | record missing areas | source knowledge, not automatic truth |
| External practices | web/GitHub search | yes for this prompt | yes | searched 2026-05-05 | fresh | if unavailable, mark unverified | watchlist unless linked CG + CUD |
| Local reference projects | user-provided paths | optional after user input | yes | git HEAD/dirty count per repo | mixed/dirty | missing paths ignored with note | local_reference only |

## Coverage Matrix

| Area | Inspected? | Evidence | Freshness | Notes |
|---|---|---|---|---|
| README | yes | `README.md`, `README.zh-CN.md` | fresh | workflow-first positioning consistent |
| CHANGELOG | yes | `CHANGELOG.md` | dirty | required for new report docs |
| package scripts | yes | `package.json` | fresh | no invented commands |
| skills | yes | `skills/*/SKILL.md` | fresh | source contracts inspected; workflows not executed |
| templates | yes | `templates/` | fresh | limited source footprint |
| src/cli | yes | `src/cli/`, `src/cli/contracts/` | fresh | no code edit performed |
| governance files | yes | `skills-governance.json`, AGENTS/CLAUDE managed blocks | fresh | source truth |
| docs | yes | `docs/README.md`, `docs/业界分析/`, `docs/solutions/` | mixed | lifecycle labels critical |
| AGENTS.md / CLAUDE.md | yes | both files | fresh | report language and changelog rules applied |
| repo-profile | partial | no root `repo-profile.yaml`; `.spec-first/specs/repo-profile.yaml` not discovered in bounded listing | missing/unknown | not treated as failure |
| graph/provider artifacts | yes | `.spec-first/graph/*`, GitNexus list | stale/partial | degraded evidence |
| prior review reports | yes | `docs/2026-05-04/project-audit/`, `.spec-first/audits/skill-audit/latest/` | stale/partial | advisory |
| compound knowledge | yes | `docs/solutions/` | mixed | reusable but needs freshness judgment |
| GitHub / external practices | yes | web + `gh search repos` + `gh repo view` | fresh | watchlist by default |
| local reference projects | yes | 10 user-provided local repos | mixed | dirty counts recorded, source truth remains spec-first |

## Existing Skill Composition Evaluation

| Component | Can do | Cannot stably do | Cycle 0 judgment |
|---|---|---|---|
| `spec-skill-audit` | audit skill source quality, trigger precision, runtime governance | decide project-level CUD alone; run external best-practice intake | sufficient as reviewer input |
| `spec-doc-review` | review requirements/plans/task docs with persona lenses or fallback | own capability upgrade decisions or implementation planning | useful for report validation |
| `spec-plan` | design implementation after Accepted CUD | decide whether CUD should exist | correct handoff target for Accepted implementation-oriented CUD |
| `spec-code-review` | review code diff with evidence | validate report-only docs unless invoked as doc review/code review appropriately | not primary for Cycle 0 docs |
| `spec-compound` | capture verified lessons | prove CUD effectiveness without review evidence | required feedback endpoint |
| `spec-compound-refresh` | maintain stale learnings | run general self-evolution | useful after repeated patterns |
| `spec-graph-bootstrap` | compile graph/provider readiness facts | guarantee current source freshness without rerun | evidence producer only |
| `spec-mcp-setup` | prepare harness/provider config | make semantic readiness judgments | deterministic setup provider |
| `using-spec-first` | route public workflow entry | become a workflow or durable artifact generator | correct entry governor |

Existing composition is enough for this report-only Cycle 0. It is not yet enough as a durable self-reflection product loop unless the reports and future CUD feedback are standardized.

## Workflow Loop Evaluation

Current closed loop exists:

```text
mcp-setup / graph-bootstrap
  -> ideate / brainstorm / doc-review
  -> spec-plan
  -> spec-write-tasks
  -> spec-work / debug / optimize / polish
  -> code-review / app-consistency-audit
  -> compound / compound-refresh / skill-audit
```

Gap: self-reflection currently sits outside the loop as a prompt/report, not a named composition artifact with stable review and compound feedback expectations.

## Skill Boundary Evaluation

Healthy boundaries:

- `spec-plan` owns HOW, not execution.
- `spec-work` owns execution, not plan mutation.
- `spec-skill-audit` owns source skill quality, not general code review.
- `spec-doc-review` owns document findings, not implementation.
- `spec-compound` owns durable learning after evidence.

Risk:

- Self-reflection can easily become a meta prompt that tries to review, plan, implement, and compound in one artifact.

## Context Routing Evaluation

Context is generally precise, but self-reflection needs stricter source tiers:

- Always read: role contract, target prompt, AGENTS/CLAUDE, package scripts, docs index.
- Read on demand: specific skill contracts, prior reports, graph facts, local refs.
- Treat as advisory: `.spec-first/*`, historical docs, GitHub projects, local dirty repos.
- Do not load globally: full historical docs, full external repo contents, generated runtime mirrors.

## Artifact Contract Evaluation

Strong:

- Task packs have validator expectations.
- Graph/provider artifacts have schema_version and generated_at.
- Skill audit report has `schema_version`, `generated_at`, and `requires_llm_review`.

Weak:

- Some graph facts lack top-level `source_commit`, `branch`, `dirty_state`.
- Self-reflection/CUD reports had no existing stable directory before this cycle.
- CUD feedback status is not yet represented as a reusable artifact field.

## Reliability Evaluation

Observed:

- `package.json` exposes real verification commands.
- Git metadata collection worked.
- GitHub CLI search worked, but exact quoted searches returned empty; broader problem-mechanism queries returned useful repos.
- GitNexus MCP responded but index was stale and prose queries returned no processes; direct source reads were used instead.

Reliability gap is not that providers are absent; it is that consumers must distinguish current, stale, partial, and definitions-only evidence.

## Docs-Code Consistency Evaluation

README and role contract align with current workflow-first positioning. Historical docs are intentionally labeled as historical/external reference by `docs/README.md`, but self-reflection reports must repeat this boundary because external/local reference projects can otherwise overpower current code facts.

## Knowledge Feedback Evaluation

`docs/solutions/` is present and useful. However, current learnings do not yet provide a standardized CUD feedback field such as:

- `linked_cud`
- `validated_by_review`
- `supersedes_gap`
- `next_cycle_trigger`

This does not require a new knowledge system; it requires clearer compound expectations for self-upgrade outcomes.

## Capability Level Matrix

| Capability | Declared | Implemented | Runnable | Verified | Reusable | Notes |
|---|---:|---:|---:|---:|---:|---|
| Workflow-first chain | yes | yes | yes | partial | yes | README + skills + package scripts support it |
| Skill audit | yes | yes | yes | partial | yes | latest report is single-skill/stale advisory |
| Document review | yes | yes | yes | partial | yes | source contract present; not invoked this cycle |
| Plan handoff | yes | yes | yes | partial | yes | strong in `spec-plan` / `spec-work`; CUD handoff not standardized |
| Code review | yes | yes | yes | partial | yes | not used for report-only docs |
| Compound learning | yes | yes | yes | partial | yes | needs CUD feedback expectation |
| Graph readiness | yes | yes | yes | stale | advisory | current artifacts stale/partial for this cycle |
| External best-practice intake | yes in prompt/docs | partial | manual | this cycle only | weak | no stable intake contract yet |
| Self-reflection/CUD loop | yes in prompt | report-only this cycle | manual | this cycle only | not yet | core improvement area |

## Conclusion

Existing composition is enough to complete Cycle 0 without adding a new public workflow. It is not enough to guarantee future cycles remain evidence-backed unless a light source-level contract clarifies self-reflection reports, CUD feedback, external evidence intake, review expectations, compound expectations, and 30-cycle next inputs.
