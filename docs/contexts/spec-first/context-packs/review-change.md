# Review Change Pack

## Review First

- `src/crg/communities.js`
- `src/crg/cli/build.js`
- `src/crg/cli/envelope.js`

## Test Gaps To Watch

- `src/cli/index.js`：CLI dispatch lacks a direct tests_for mapping in CRG and is mostly covered by smoke/integration scripts.
- `src/cli/commands/doctor.js`：Doctor command checks many environment branches but has no direct CRG tests_for evidence.
- `src/cli/commands/init.js`：Init has broad runtime side effects and is validated mainly through smoke/install scripts instead of direct unit mapping.
- `src/crg/changes.js`：Change detection logic participates in high-criticality review flows but no direct tests_for link was returned.

## Entrypoints Likely To Matter

- `bin/spec-first.js`：CLI bin entry that dispatches into src/cli and CRG router
- `src/crg/cli/router.js`：Dispatches CRG subcommands such as build, stats, search and review-context
- `src/crg/cli/postprocess.js`：run -> resolveGraphDb -> requireSqlite -> initDatabase
- `src/cli/index.js`：runCli -> printHelp -> printVersion -> maybeShowVersionReminder
- `src/crg/commands/review-context.js`：run -> openDb -> detectChanges -> isSensitiveFile
- `src/crg/commands/detect-changes.js`：run -> openDb -> detectChanges -> makeEnvelope
- `src/crg/cli/build.js`：runStats -> resolveGraphDb -> requireSqlite -> initDatabase

## Integrations

- `database` via `src/crg/migrations.js`
- `tooling` via `src/crg/input-convergence.js`
- `parser` via `src/crg/lang-config.js`
- `test-framework` via `tests/contracts/crg-cli-v1.test.js`
