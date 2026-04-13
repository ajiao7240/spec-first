# High-Risk Modules

## src/crg/communities.js

- Symbol: `src/crg/communities.js#function#writeCommunities#L71`
- Kind: large-function
- Severity: high
- Why: writeCommunities is the largest function in the repo and central to CRG postprocess output generation.
- Evidence: large-functions loc=297

## src/crg/cli/build.js

- Symbol: `src/crg/cli/build.js#function#runBuildAsync#L120`
- Kind: large-function
- Severity: high
- Why: runBuildAsync is a wide orchestration function that spans graph build, parser quality and artifact writes.
- Evidence: large-functions loc=250

## src/crg/input-convergence.js

- Symbol: `src/crg/input-convergence.js#function#collectInputFiles#L471`
- Kind: large-function
- Severity: medium
- Why: collectInputFiles aggregates multiple file-selection rules and ignore logic, making it error-prone when changing indexing behavior.
- Evidence: large-functions loc=243

## src/crg/cli/envelope.js

- Symbol: `src/crg/cli/envelope.js#function#makeEnvelope#L20`
- Kind: hub
- Severity: high
- Why: makeEnvelope is the highest in-degree helper and affects nearly every CRG command response shape.
- Evidence: god-nodes in_degree=19

## src/cli/plugin.js

- Symbol: `src/cli/plugin.js#function#getBundledPath#L52`
- Kind: hub
- Severity: medium
- Why: getBundledPath is a high fan-in helper inside runtime asset installation, so path changes can ripple across multiple commands.
- Evidence: god-nodes in_degree=9

## src/cli/index.js

- Symbol: `src/cli/index.js#function#runCli#L9`
- Kind: coverage-gap
- Severity: medium
- Why: The primary CLI dispatch flow is covered by smoke/integration scripts but has no direct tests_for match in the graph.
- Evidence: tests_for runCli returned []
