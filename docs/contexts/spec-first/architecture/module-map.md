# Module Map

## Communities

### crg/0

- 路径：`src/crg`
- 职责：Builds and queries the local code relationship graph, including indexing, search, flows, communities, impact and review-context.
- 证据：CRG top flows and top hubs dominate graph context

### cli

- 路径：`src/cli`
- 职责：Owns user-facing CLI commands, platform adapters, runtime sync, doctor checks and governance injection.
- 证据：top flow src/cli/index.js#runCli

### skills

- 路径：`skills`
- 职责：Stores workflow assets, templates and helper scripts consumed by runtime installation.
- 证据：skills community present in CRG context

### tests

- 路径：`tests`
- 职责：Provides shell-first smoke/integration/e2e coverage plus unit/contracts coverage for CLI and CRG internals.
- 证据：tests/unit tests/smoke tests/integration tests/e2e tests/contracts

## Data Shapes

- `package.json` (schema)：Defines the CLI package contract: bin entry, scripts, dependency/runtime boundaries and publishable files.
- `src/crg/input-convergence.js` (validation)：SimpleIgnore encapsulates ignore pattern handling for CRG input filtering and path exclusion.

## Architecture Hints

- Top communities：crg/0(31)、cli(18)、skills(11)
- Top hubs：makeEnvelope@src/crg/cli/envelope.js、openDb@src/crg/cli/open-db.js、getBundledPath@src/cli/plugin.js、exists@skills/onboarding/scripts/inventory.mjs、loadPluginManifest@src/cli/plugin.js
- Cross-community edges show bin -> cli/crg and tests -> src coupling, which matches a CLI tool with internal graph engine.
