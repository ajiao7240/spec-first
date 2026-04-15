# Public Entrypoints

## src/cli/index.js

- Symbol: `src/cli/index.js#function#runCli#L9`
- Kind: `cli`
- Summary: 主 CLI 入口，分发 help/version/doctor/init/clean 等命令。
- Evidence: `crg flow src/cli/index.js#function#runCli#L9` + `package.json bin.spec-first`

## src/crg/cli/router.js

- Symbol: `src/crg/cli/router.js#function#run#L107`
- Kind: `cli`
- Summary: CRG 子命令总入口，路由 17 个 graph 命令。
- Evidence: `crg search router` 命中 `src/crg/cli/router.js`

## src/crg/cli/postprocess.js

- Symbol: `src/crg/cli/postprocess.js#function#run#L87`
- Kind: `worker`
- Summary: CRG 后处理入口，串联 communities/flows/analyze/rebuildFTS。
- Evidence: `crg flow flow:src/crg/cli/postprocess.js#function#run#L87:22`

## src/crg/commands/review-context.js

- Symbol: `src/crg/commands/review-context.js#function#run#L30`
- Kind: `worker`
- Summary: 按变更生成 review context，联动 detectChanges 与 reverse BFS。
- Evidence: `crg flow flow:src/crg/commands/review-context.js#function#run#L30:35`

## src/crg/commands/detect-changes.js

- Symbol: `src/crg/commands/detect-changes.js#function#run#L23`
- Kind: `worker`
- Summary: 按 git diff 计算风险与受影响节点。
- Evidence: `crg flow flow:src/crg/commands/detect-changes.js#function#run#L23:29`
