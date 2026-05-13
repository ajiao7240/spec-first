# Boundary And Overlap Report

## Table 1: Skill Boundary Issues

| skill_id | issue_type | evidence | impact | recommendation | priority |
| --- | --- | --- | --- | --- | --- |
| `test-browser` | internal helper exposed as public command | Governance marks `test-browser` `internal_only`; skill body includes `/test-browser` examples and a “Fix now” mutation option. | Hidden test helper can become a user entrypoint and take write authority outside parent workflow. | Remove public examples; emit browser evidence only; parent workflow owns fix decisions. | P0 |
| `test-xcode` | internal helper exposed as public command | Governance marks `test-xcode` `internal_only`; skill body includes `/test-xcode` examples and “Fix now.” | iOS simulator helper can mutate/retest outside explicit work/review ownership. | Remove public examples; emit simulator evidence only; parent workflow owns fix decisions. | P0 |
| `using-spec-first` | router recommends internal helper | Route map sends PR description requests to `git-commit-push-pr` description-only mode while governance marks that skill `internal_only`. | Entry router leaks hidden helper surface and contradicts its own “do not expose internal-only skills” rule. | Route through public work/shipping handoff or answer with guide-mode next step only. | P0 |
| `lfg` | legacy central autonomous pipeline | Skill says legacy/internal, but still executes review, test, commit, push, and PR creation. | Reintroduces a central workflow engine and silent side effects. | Retire or hard-hide; leave only migration note if compatibility is needed. | P0 |
| `spec-brainstorm` | workflow contract buried | Rich phases exist, but no compact Inputs/Outputs contract was detected by the audit. | Downstream plan handoff depends on prose interpretation. | Add top-level contract summary and artifact header for requirements docs. | P1 |
| `spec-work-beta` | beta execution overlaps stable work | Boundary matrix reports `spec-work` vs `spec-work-beta` overlap. | Users and entry router may over-select beta delegation. | Keep beta explicit opt-in; document delta from stable work in the first screen. | P1 |
| `spec-graph-bootstrap` / `spec-mcp-setup` | setup vs graph refresh boundary | Source prose separates install/projection from graph refresh, but overlap remains easy to reintroduce. | Setup scripts could start owning graph semantic readiness. | Preserve graph refresh ownership in graph-bootstrap; add contract tests when touched. | P2 |
| `spec-plan` / `spec-write-tasks` | plan vs task-pack boundary | Task-pack derives from plan and carries execution details. | Task pack can drift into a second plan. | Keep `source_plan_hash` and semantic-faithfulness gate. | P1 |
| `git-commit` / `git-commit-push-pr` / `resolve-pr-feedback` | mutation and publishing boundary | These skills can stage, commit, push, PR, or apply review feedback. | Incorrect routing can publish changes before review/changelog/test gates. | Require explicit user/workflow shipping intent, preview-first staging summary, and changelog gate. | P1 |
| `feature-video` | public upload boundary | Demo/evidence capture can move from local artifact to shareable media. | Upload before preview can leak unfinished or sensitive UI. | Local preview first, explicit confirm before upload or external share. | P1 |
| standalone helper skills | auxiliary skills look like public workflows | `git-worktree`, `proof`, creative/test helpers have weak contracts. | Entry routing and public surface can become a skill collection. | Mark internal/auxiliary status and add When Not To Use plus no public entrypoint guarantee. | P1 |

## Table 2: Agent Boundary Issues

| agent_id | issue_type | evidence | impact | recommendation | priority |
| --- | --- | --- | --- | --- | --- |
| `spec-design-iterator` | mutating workflow hidden as agent | Proactive screenshot-analyze-improve cycles with no parent-owned write/stop/verification contract. | Agent can become its own workflow and declare completion. | Retire or move into explicit opt-in workflow phase. | P0 |
| `spec-figma-design-sync` | mutating workflow hidden as agent | Captures Figma/browser state, changes code, verifies, and declares completion. | Tool and write authority bypass parent skill. | Split read-only diagnosis from workflow-owned mutation. | P0 |
| `spec-product-lens-reviewer` / `spec-design-lens-reviewer` / `spec-security-lens-reviewer` | lens vs agent ambiguity | Names say lens, but files live as agents and some output freeform. | Parent synthesis must normalize inconsistent artifacts. | Declare lens output contract or migrate to shared doc-review finding envelope. | P1 |
| `spec-architecture-strategist` | broad expert agent | File lacks the code-review persona JSON pattern. | Can duplicate architecture reviewers and make final synthesis unstable. | Narrow trigger or retire in favor of structured architecture reviewer. | P1 |
| `spec-ankane-readme-writer` | writer agent, not reviewer | No direct skill consumer found. | Sits outside Harness review chain. | Move behind explicit standalone workflow or mark auxiliary/manual-only. | P1 |
| `spec-data-integrity-guardian` / `spec-data-migration-expert` / `spec-data-migrations-reviewer` | overlapping data roles | Three data-oriented agents with different output maturity. | Reviewer selection and synthesis may duplicate data findings. | Keep `spec-data-migrations-reviewer` for code review; merge/retire older broad profiles. | P1 |
| `spec-security-sentinel` / `spec-security-reviewer` / `spec-security-lens-reviewer` | overlapping security roles | Security appears as code reviewer, plan lens, and broad sentinel. | Useful split, but sentinel is weaker and broad. | Keep plan-level vs diff-level split; retire sentinel from default path or make explicit deep audit. | P1 |

## Table 3: Overlap / Merge Suggestions

| objects | overlap_type | why_overlap | suggested_action | risk | priority |
| --- | --- | --- | --- | --- | --- |
| `spec-work`, `spec-work-beta` | stable/beta execution | Same stage, beta adds delegate mode. | Keep beta explicit and prevent guide-mode recommendation unless requested. | Accidental beta use. | P1 |
| `spec-code-review`, `spec-doc-review` | review workflows | Both dispatch reviewers and synthesize findings. | Keep code diff vs document artifact boundary; share finding schema only. | Review route confusion. | P2 |
| `spec-graph-bootstrap`, `spec-standards` | evidence producer chain | Standards consumes graph facts. | Keep graph as deterministic readiness, standards as semantic baseline. | Scripts making standards judgment. | P2 |
| Kieran reviewers | stack-specific quality lenses | Same philosophy across Rails/Python/TypeScript. | Keep separate by stack but share template. | Template drift. | P2 |
| design agents | implementation sync, iterator, lens | UI design appears as work helper, browser loop, and doc lens. | Define which are workflow stages vs reviewer lenses. | Over-dispatch / context bloat. | P1 |
| research agents | web, framework docs, best practices | Three broad external research roles overlap. | Define source authority split and budget defaults. | Context bloat / conflicting citations. | P1 |
