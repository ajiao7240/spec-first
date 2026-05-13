# Skill / Agent Harness Audit Summary

## Audit Metadata

| Field | Value |
| --- | --- |
| Objective source | `docs/10-prompt/审查skill.md` |
| Role baseline | `docs/10-prompt/结构化项目角色契约.md` |
| Audit time | 2026-05-14 CST |
| Branch | `leo-2026-05-13-skill` |
| HEAD at initial artifact run | `7e18a210ac9f0a0d086c5cb19d1d20e49f138664` |
| Source skill audit script | `skills/spec-skill-audit/scripts/write-audit-artifacts.js` |
| Source audit artifacts | `.spec-first/audits/skill-audit/latest/` |
| Skill markdown files reviewed | 40 |
| Agent markdown files reviewed | 51 |
| Cross-review coverage | Every `SKILL.md` and every `*.agent.md` received two read-only reviewer passes: contract review + boundary/overlap review |
| Runtime drift status | Unverified. `--runtime` attempt failed trusted-checkout validation for this checkout. |
| Overall maturity | Current H4: Evidence-governed Harness; target H5: Review-closed Engineering Loop |

## Phase 1 Precheck Evidence

| Required precheck | Evidence | Status |
| --- | --- | --- |
| Current branch | `git branch --show-current` -> `leo-2026-05-13-skill` | confirmed |
| Git status | Dirty worktree with existing user/other-agent changes; this audit did not revert unrelated files | confirmed |
| `skills/` listing and `SKILL.md` discovery | 40 `skills/**/SKILL.md` files | confirmed |
| `agents/` listing and agent file discovery | 51 `agents/*.agent.md` files; no agent YAML files found in this count | confirmed |
| Skill README / contract / script discovery | 4 `skills/**/README.md`, 0 `skills/**/contract.yaml`, 121 files under `skills/**/scripts/` | confirmed |
| Host entry docs | `CLAUDE.md` and `AGENTS.md` exist | confirmed |
| Runtime mirror directories | `.claude/`, `.codex/`, `.agents/`, `.spec-first/` exist | confirmed |
| Planning/reference docs | `docs/10-prompt/` and `docs/02-架构设计/` exist; no `docs/roadmap` directory was found at max depth 2 | confirmed |
| Root project docs/config | `README.md`, `README.zh-CN.md`, `package.json`, and `CHANGELOG.md` exist | confirmed |
| Source implementation scope | `templates/` has 23 files; `src/cli/` has 38 files | confirmed |
| Changelog format | Root `CHANGELOG.md` declares `- v版本号 YYYY-MM-DD HH:MM:SS 作者: 变更摘要 [(user-visible)]` | confirmed |

Scope note: the row-level scorecards cover every source skill and agent Markdown file. Scripts, templates, CLI, root docs, governance JSON, and runtime mirrors were used as boundary, artifact, and source/runtime evidence; they were not assigned per-file 100-point score rows because the prompt's scoring phases are specifically skill/agent Markdown scoring phases.

## Execution Evidence

This audit used three evidence layers:

1. Deterministic source scan from `node skills/spec-skill-audit/scripts/write-audit-artifacts.js --repo .`.
2. Direct source reads of `skills/**/SKILL.md`, `agents/*.agent.md`, governance docs, and selected parent workflow references.
3. Cross-reviewer synthesis: one contract reviewer and one boundary/overlap reviewer for every Markdown file under review.

The source scan reported 40 skills, 51 agents, deterministic skill signals P0 0 / P1 180 / P2 102, and agent heuristic signals P1 32 / P2 3. Those numbers are signals, not release gates. The final P0/P1/P2 below are semantic Harness risks after reviewer synthesis.

## Cross-Review Coverage

| Batch | Scope | Files | Reviewer A | Reviewer B | Status |
| --- | --- | ---: | --- | --- | --- |
| S1 | `agent-native-*`, legacy helper/productivity skills through `git-commit` | 8 | Skill contract | Skill boundary/overlap | Complete |
| S2 | `git-commit-push-pr` through `spec-brainstorm` | 8 | Skill contract | Skill boundary/overlap | Complete |
| S3 | `spec-code-review` through `spec-ideate` | 8 | Skill contract | Skill boundary/overlap | Complete |
| S4 | `spec-mcp-setup` through `spec-slack-research` | 8 | Skill contract | Skill boundary/overlap | Complete |
| S5 | `spec-standards` through `using-spec-first` | 8 | Skill contract | Skill boundary/overlap | Complete |
| A1 | `spec-adversarial-document-reviewer` through `spec-cli-readiness-reviewer` | 9 | Agent contract | Agent boundary/overlap | Complete |
| A2 | `spec-code-simplicity-reviewer` through `spec-design-iterator` | 9 | Agent contract | Agent boundary/overlap | Complete |
| A3 | `spec-design-lens-reviewer` through `spec-kieran-python-reviewer` | 9 | Agent contract | Agent boundary/overlap | Complete |
| A4 | `spec-kieran-rails-reviewer` through `spec-previous-comments-reviewer` | 9 | Agent contract | Agent boundary/overlap | Complete |
| A5 | `spec-product-lens-reviewer` through `spec-security-sentinel` | 9 | Agent contract | Agent boundary/overlap | Complete |
| A6 | `spec-session-historian` through `spec-web-researcher` | 6 | Agent contract replacement after one interrupted reviewer | Agent boundary/overlap | Complete |

One A6 contract reviewer connection ended before completion; it was not counted. A replacement reviewer completed the same six-file assignment.

## Source / Runtime Boundary Assessment

| Boundary | Evidence | Risk | Judgment |
| --- | --- | --- | --- |
| Source skills | `skills/` contains 40 `SKILL.md` files | Low | Source of truth is clear. |
| Source agents | `agents/` contains 51 `*.agent.md` files | Medium | Many older profiles lack stable output and input contracts. |
| Runtime mirrors | `.claude/`, `.codex/`, `.agents/skills/`, `.spec-first/` exist | Medium | Treat as generated/runtime delivery surface, not source. |
| Runtime drift audit | `--runtime` failed trusted-checkout validation | High | Runtime parity is not confirmed clean in this audit. |
| Runtime stale evidence | Cross-review observed `.agents/skills/spec-skill-audit/SKILL.md` still pointing at `.agents/skills/...` script paths while source points at `skills/...` | High | At least one runtime mirror may be stale. Regenerate with `spec-first init --codex|--claude` after source fixes, do not hand-edit mirrors. |
| Changelog governance | Project policy requires source/docs changes in `CHANGELOG.md` | Medium | This audit adds tracked docs and therefore updates the changelog. |

## Git Status At Audit Start

The worktree already contained user/other-agent changes before this audit. This report did not revert or normalize them.

```text
M CHANGELOG.md
M docs/README.md
M docs/plans/2026-05-07-001-feat-skill-agent-quality-governance-plan.md
M docs/plans/2026-05-07-003-feat-code-review-graph-evidence-preflight-plan.md
M docs/plans/2026-05-09-003-feat-graph-bootstrap-fast-reuse-plan.md
M docs/plans/2026-05-12-003-feat-graph-bootstrap-incremental-refresh-plan.md
M skills/agent-native-audit/SKILL.md
M skills/gemini-imagegen/SKILL.md
M skills/git-worktree/SKILL.md
M skills/spec-optimize/scripts/experiment-worktree.sh
M src/cli/contracts/security/secret-deny-patterns.schema.json
M tests/unit/*
?? docs/00-版本路线/版本规划.md
?? docs/10-prompt/审查skill.md
?? docs/contracts/workflows/skill-agent-quality-governance.md
?? skills/*/evals/
?? tests/unit/*quality-governance*
```

## Executive Judgment

`spec-first` is not a prompt collection anymore. The strongest assets already behave like Harness nodes: `spec-graph-bootstrap`, `spec-write-tasks`, `spec-code-review`, `spec-doc-review`, `spec-app-consistency-audit`, `spec-plan`, `spec-skill-audit`, and the structured code-review persona family.

The system is not yet H5 because the closure contract is uneven:

- public/internal governance conflicts are still present in helper skills;
- some agents are mutating workers disguised as reviewers;
- doc-review lenses rely on parent templates for output contracts but do not state that locally;
- old broad expert agents overlap with newer structured reviewers;
- review finding, evidence packet, artifact header, and compound delta conventions are not shared across all durable stages;
- runtime drift could not be verified in this run.

## Final Semantic Counts

| Priority | Count | Meaning |
| --- | ---: | --- |
| P0 | 8 | Blocks trustworthy Harness use until rewritten, retired, or gated. |
| P1 | 42 | High-priority contract, boundary, evidence, safety, or overlap issues. |
| P2 | 68 | Template, clarity, output-shape, degraded-mode, or context-budget improvements. |

The P0 count is semantic, not the deterministic script count. Deterministic script P0 remained 0.

## P0 Summary

| id | Object | Finding | Immediate action |
| --- | --- | --- | --- |
| P0-001 | `test-browser` | Governance marks it `internal_only`, but the skill exposes `/test-browser` usage examples and can hand off to “fix now.” | Remove public entry examples; make it delegated evidence-only helper. |
| P0-002 | `test-xcode` | Governance marks it `internal_only`, but the skill exposes `/test-xcode` usage examples and can hand off to “fix now.” | Remove public entry examples; make it delegated evidence-only helper. |
| P0-003 | `using-spec-first` | Route map recommends `git-commit-push-pr` description mode while governance marks it `internal_only` and hidden helper rules forbid this class. | Remove direct route; route PR descriptions through active work/shipping handoff. |
| P0-004 | `lfg` | Legacy autonomous pipeline still looks like central plan/work/review/test/PR engine and defaults toward commit/push/PR behavior. | Hard-hide or retire; do not expose as public workflow. |
| P0-005 | `spec-design-iterator.agent.md` | Proactive mutating agent with no stable write, input, stop, verification, or evidence contract. | Retire or move into explicit opt-in workflow phase. |
| P0-006 | `spec-figma-design-sync.agent.md` | Agent performs browser/Figma capture, code modification, verification, and completion assertion without tool/write contract. | Retire as standalone agent or split into read-only diagnosis plus workflow-owned mutation. |
| P0-007 | Runtime drift audit | Runtime parity is unverified; explicit runtime audit failed trusted-checkout validation. | Fix drift audit support or document degraded reason; regenerate mirrors only from source. |
| P0-008 | Shared review closure | Code/doc/app review use strong local schemas but no common `review-finding.v1` minimum. | Introduce shared minimum finding envelope; keep domain extensions. |

## Best Current Templates

| Kind | Template candidates |
| --- | --- |
| Skills | `spec-skill-audit`, `spec-graph-bootstrap`, `spec-write-tasks`, `spec-doc-review`, `spec-plan` |
| Agents | `spec-adversarial-reviewer`, `spec-api-contract-reviewer`, `spec-correctness-reviewer`, `spec-performance-reviewer`, `spec-security-reviewer`, `spec-project-standards-reviewer`, `spec-testing-reviewer` |

## Most Urgent Rewrite Candidates

| Kind | Candidates |
| --- | --- |
| Skills | `test-browser`, `test-xcode`, `using-spec-first`, `lfg`, `spec-work-beta`, `spec-optimize`, `spec-polish-beta`, `spec-slack-research` |
| Agents | `spec-design-iterator`, `spec-figma-design-sync`, `spec-security-sentinel`, `spec-pattern-recognition-specialist`, `spec-performance-oracle`, `spec-architecture-strategist`, `spec-ankane-readme-writer` |

## Recommendation

Pause net-new skill/agent expansion except for missing stage contracts that cannot be represented by existing assets. The next phase should harden public/internal boundaries, retire or downgrade broad agents, normalize output contracts, and make runtime drift verification reliable.
