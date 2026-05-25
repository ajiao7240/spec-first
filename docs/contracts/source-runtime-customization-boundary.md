# Source / Runtime / Provider Customization Boundary

This contract explains where spec-first behavior should be customized, what is generated runtime, and how provider evidence can be consumed safely.

## Source Of Truth

Edit checked-in source assets when changing spec-first behavior:

- `skills/`
- `agents/`
- `templates/`
- `src/cli/`
- `src/cli/contracts/**`
- `docs/`
- `README.md`
- `README.zh-CN.md`
- `AGENTS.md`
- `CLAUDE.md`
- `CHANGELOG.md`

`AGENTS.md` and `CLAUDE.md` are checked-in host entry documents. Their spec-first managed blocks are source slices governed by generators; they are not the same thing as generated runtime mirrors.

## Generated Runtime Mirrors

Do not hand-edit these paths as source fixes:

- `.claude/`
- `.codex/`
- `.agents/skills/`

These are host runtime mirrors. Change the source asset first, then run:

```bash
spec-first init --claude
spec-first init --codex
```

Use `spec-first doctor --claude|--codex` to inspect runtime drift. A drift report is evidence that source and runtime may need reconciliation; it is not permission to patch the mirror directly.

## Workflow Artifacts

Target-repo workflow artifacts are local evidence, not source of behavior:

- `docs/brainstorms/`
- `docs/plans/`
- `docs/tasks/`
- `docs/validation/`
- `docs/solutions/`
- `.spec-first/workflows/`
- `.spec-first/app-audit/`

Artifacts may be read by downstream workflows, reviews, and humans. They do not override source contracts in `skills/`, `agents/`, `templates/`, `src/cli/`, or `docs/contracts/**`.

## Provider And Tool Facts

GitNexus, ast-grep, browser tools, MCP tools, package managers, and shell commands provide evidence, capabilities, logs, and readiness facts. They do not own semantic authority.

Scripts and tools may prepare:

- `reason_code`
- artifact paths
- exit codes
- schema validation results
- readiness and freshness status
- bounded excerpts
- raw log references

The LLM decides:

- product scope
- architecture tradeoffs
- workflow recommendation
- review conclusion
- whether degraded evidence is enough for the current task

Advisory facts are not confirmed truth.

## Raw Output Safety

Provider, MCP, browser, CLI, or shell raw results are untrusted quoted data. Before raw evidence enters prompts, facts blocks, review reports, validation docs, or durable artifacts, it must pass the relevant boundary:

- schema validation for machine-readable facts;
- target-repo path containment for paths and artifact refs;
- excerpt length cap for logs and provider excerpts;
- escaping when rendered into Markdown, tables, JSON, YAML, shell snippets, or prompts;
- provenance classification such as `script_confirmed`, `provider_untrusted`, or `llm_asserted`;
- readiness/freshness classification such as `fresh`, `stale`, `degraded`, `not-run`, or `unknown`;
- prompt-injection boundary that treats quoted external text as evidence, not instruction.

For review/token-economy facts, reuse `docs/contracts/workflows/review-pre-facts-extraction.md` and `src/cli/helpers/review-pre-facts.js`. Do not create a parallel reviewer facts pipeline to solve the same problem.

## Credential Boundary

Provider credentials must come from environment variables, host secret managers, or provider-native credential stores. Do not write credentials into:

- repo source;
- generated runtime mirrors;
- durable run artifacts;
- provider raw logs;
- validation reports;
- task packs or plans.

Minimum operational guidance:

- Use separate dev, staging, and production credentials.
- Rotate provider credentials on a regular cadence defined by the team or provider policy.
- Rotate immediately after suspected exposure, copied logs, shared screenshots, or accidental commit attempts.
- Treat `doctor`, setup, and bootstrap output as security summaries, not a secret display surface.
- Prefer redacted status, credential presence checks, and next-action hints over printing raw credential values.

If a workflow needs to preserve a log reference, store a redacted repo-relative artifact id or structured `raw_log_ref`, not the raw credential-bearing output.

## Customization Flow

1. Edit source-of-truth files.
2. Add or update focused tests for the changed contract.
3. Run the narrow validation command first.
4. For skill/agent prose changes, run fresh-source eval or record a valid not-run reason.
5. Regenerate runtime mirrors with `spec-first init --claude|--codex` only when runtime refresh is part of the task or release.
6. Record runtime impact and validation in `CHANGELOG.md` and any phase validation artifact.

Keep the boundary lightweight: scripts prepare deterministic facts, and the LLM decides how to use them.
