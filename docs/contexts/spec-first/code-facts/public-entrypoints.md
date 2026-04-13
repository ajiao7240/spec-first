# Public Entrypoints

## bin/spec-first.js

- Symbol: `bin/spec-first.js#module#spec-first.js#L0`
- Kind: bin
- Summary: CLI bin entry that dispatches into src/cli and CRG router
- Evidence: package.json bin.spec-first=./bin/spec-first.js

## src/crg/cli/router.js

- Symbol: `src/crg/cli/router.js#function#run#L107`
- Kind: cli-router
- Summary: Dispatches CRG subcommands such as build, stats, search and review-context
- Evidence: crg search router matched src/crg/cli/router.js

## src/crg/cli/postprocess.js

- Symbol: `src/crg/cli/postprocess.js#function#run#L87`
- Kind: cli-flow
- Summary: run -> resolveGraphDb -> requireSqlite -> initDatabase
- Evidence: flow_id=flow:src/crg/cli/postprocess.js#function#run#L87:22；criticality=0.7557894736842106；node_count=19

## src/cli/index.js

- Symbol: `src/cli/index.js#function#runCli#L9`
- Kind: cli-flow
- Summary: runCli -> printHelp -> printVersion -> maybeShowVersionReminder
- Evidence: flow_id=flow:src/cli/index.js#function#runCli#L9:13；criticality=0.74；node_count=20

## src/crg/commands/review-context.js

- Symbol: `src/crg/commands/review-context.js#function#run#L30`
- Kind: cli-flow
- Summary: run -> openDb -> detectChanges -> isSensitiveFile
- Evidence: flow_id=flow:src/crg/commands/review-context.js#function#run#L30:35；criticality=0.69；node_count=14

## src/crg/commands/detect-changes.js

- Symbol: `src/crg/commands/detect-changes.js#function#run#L23`
- Kind: cli-flow
- Summary: run -> openDb -> detectChanges -> makeEnvelope
- Evidence: flow_id=flow:src/crg/commands/detect-changes.js#function#run#L23:29；criticality=0.66；node_count=11

## src/crg/cli/build.js

- Symbol: `src/crg/cli/build.js#function#runStats#L392`
- Kind: cli-flow
- Summary: runStats -> resolveGraphDb -> requireSqlite -> initDatabase
- Evidence: flow_id=flow:src/crg/cli/build.js#function#runStats#L392:20；criticality=0.6557142857142857；node_count=7
