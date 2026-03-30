# Persona Catalog

15 reviewer personas organized into always-on, cross-cutting conditional, and stack-specific conditional layers, plus CE-specific agents. The orchestrator uses this catalog to select which reviewers to spawn for each review.

## Always-on (4 personas + 2 CE agents)

Spawned on every review regardless of diff content.

**Persona agents (structured JSON output):**

| Persona | Agent | Focus |
|---------|-------|-------|
| `correctness` | `.codex/agents/review/correctness-reviewer.md` | Logic errors, edge cases, state bugs, error propagation, intent compliance |
| `testing` | `.codex/agents/review/testing-reviewer.md` | Coverage gaps, weak assertions, brittle tests, missing edge case tests |
| `maintainability` | `.codex/agents/review/maintainability-reviewer.md` | Coupling, complexity, naming, dead code, premature abstraction |
| `project-standards` | `.codex/agents/review/project-standards-reviewer.md` | CLAUDE.md and AGENTS.md compliance -- frontmatter, references, naming, cross-platform portability, tool selection |

**CE agents (unstructured output, synthesized separately):**

| Agent | Focus |
|-------|-------|
| `.codex/agents/review/agent-native-reviewer.md` | Verify new features are agent-accessible |
| `.codex/agents/research/learnings-researcher.md` | Search docs/solutions/ for past issues related to this PR's modules and patterns |

## Conditional (6 personas)

Spawned when the orchestrator identifies relevant patterns in the diff. The orchestrator reads the full diff and reasons about selection -- this is agent judgment, not keyword matching.

| Persona | Agent | Select when diff touches... |
|---------|-------|---------------------------|
| `security` | `.codex/agents/review/security-reviewer.md` | Auth middleware, public endpoints, user input handling, permission checks, secrets management |
| `performance` | `.codex/agents/review/performance-reviewer.md` | Database queries, ORM calls, loop-heavy data transforms, caching layers, async/concurrent code |
| `api-contract` | `.codex/agents/review/api-contract-reviewer.md` | Route definitions, serializer/interface changes, event schemas, exported type signatures, API versioning |
| `data-migrations` | `.codex/agents/review/data-migrations-reviewer.md` | Migration files, schema changes, backfill scripts, data transformations |
| `reliability` | `.codex/agents/review/reliability-reviewer.md` | Error handling, retry logic, circuit breakers, timeouts, background jobs, async handlers, health checks |
| `adversarial` | `.codex/agents/review/adversarial-reviewer.md` | Diff has >=50 changed non-test, non-generated, non-lockfile lines, OR touches auth, payments, data mutations, external API integrations, or other high-risk domains |

## Stack-Specific Conditional (5 personas)

These reviewers keep their original opinionated lens. They are additive with the cross-cutting personas above, not replacements for them.

| Persona | Agent | Select when diff touches... |
|---------|-------|---------------------------|
| `dhh-rails` | `.codex/agents/review/dhh-rails-reviewer.md` | Rails architecture, service objects, authentication/session choices, Hotwire-vs-SPA boundaries, or abstractions that may fight Rails conventions |
| `kieran-rails` | `.codex/agents/review/kieran-rails-reviewer.md` | Rails controllers, models, views, jobs, components, routes, or other application-layer Ruby code where clarity and conventions matter |
| `kieran-python` | `.codex/agents/review/kieran-python-reviewer.md` | Python modules, endpoints, services, scripts, or typed domain code |
| `kieran-typescript` | `.codex/agents/review/kieran-typescript-reviewer.md` | TypeScript components, services, hooks, utilities, or shared types |
| `julik-frontend-races` | `.codex/agents/review/julik-frontend-races-reviewer.md` | Stimulus/Turbo controllers, DOM event wiring, timers, async UI flows, animations, or frontend state transitions with race potential |

## CE Conditional Agents (migration-specific)

These CE-native agents provide specialized analysis beyond what the persona agents cover. Spawn them when the diff includes database migrations, schema.rb, or data backfills.

| Agent | Focus |
|-------|-------|
| `.codex/agents/review/schema-drift-detector.md` | Cross-references schema.rb changes against included migrations to catch unrelated drift |
| `.codex/agents/review/deployment-verification-agent.md` | Produces Go/No-Go deployment checklist with SQL verification queries and rollback procedures |

## Selection rules

1. **Always spawn all 4 always-on personas** plus the 2 CE always-on agents.
2. **For each cross-cutting conditional persona**, the orchestrator reads the diff and decides whether the persona's domain is relevant. This is a judgment call, not a keyword match.
3. **For each stack-specific conditional persona**, use file types and changed patterns as a starting point, then decide whether the diff actually introduces meaningful work for that reviewer. Do not spawn language-specific reviewers just because one config or generated file happens to match the extension.
4. **For CE conditional agents**, spawn when the diff includes migration files (`db/migrate/*.rb`, `db/schema.rb`) or data backfill scripts.
5. **Announce the team** before spawning with a one-line justification per conditional reviewer selected.
