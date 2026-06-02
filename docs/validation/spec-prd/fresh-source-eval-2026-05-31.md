# spec-prd Fresh-Source Eval

```yaml
fresh_source_eval:
  status: not_run
  source_paths:
    - skills/spec-prd/SKILL.md
    - skills/spec-prd/references/intent-routing.md
    - skills/spec-prd/references/current-state-analysis.md
    - skills/spec-prd/references/change-topology-lens.md
    - skills/spec-prd/references/domain-language-and-decision-ledger.md
    - skills/spec-prd/references/prd-output-template.md
    - skills/spec-prd/references/domain-lenses.md
    - skills/spec-prd/references/prd-readiness-lens.md
    - skills/spec-prd/templates/standard/README.md
    - skills/spec-prd/templates/standard/00-通用增量需求模板.md
    - skills/spec-prd/templates/standard/10-App客户端需求模板.md
    - skills/spec-prd/templates/standard/20-Admin中后台需求模板.md
    - skills/spec-prd/templates/standard/30-Backend中台服务需求模板.md
    - skills/spec-prd/evals/examples.json
    - templates/claude/commands/spec/prd.md
    - src/cli/contracts/dual-host-governance/skills-governance.json
    - skills/using-spec-first/SKILL.md
    - skills/spec-plan/SKILL.md
  runtime_paths_checked: []
  changed_behavior: "Adds the public brownfield PRD workflow and later strengthens it with an early Framing Gate, Evidence Plan, change-topology, owner-question ladder, surface map, producer/consumer, source-of-truth, negative acceptance, and handoff entropy gates."
  reviewer_context: "fresh source snippets from current disk were not dispatched to a separate reviewer in this run"
  checks:
    trigger_precision: not_checked
    source_runtime_boundary: not_checked
    host_entrypoints: not_checked
    internal_only_boundary: not_checked
    deterministic_vs_semantic_boundary: not_checked
    tests: not_checked
  findings: []
  not_run_reason: "Fresh read-only subagent dispatch was not executed in this run. The current subagent tool policy allows spawning only when the user explicitly asks for sub-agents/delegation/parallel agent work; source contract tests and direct source reads are used as fallback evidence. Runtime mirrors were not treated as source."
```
