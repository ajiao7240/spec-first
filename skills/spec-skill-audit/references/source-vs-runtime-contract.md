# Source Vs Runtime Contract

Source-of-truth lives in:

- `skills/`
- `agents/`
- `templates/`
- `src/cli/contracts/dual-host-governance/`
- runtime delivery code under `src/cli/`

Generated runtime assets live in:

- `.claude/`
- `.codex/`
- `.agents/skills/`

Audit may read generated runtime assets to detect drift. It must not patch them. The only repair recommendation for generated runtime drift is to rerun `spec-first init` with the target host selected.
