# Review Change Pack

## Review First

- `src/crg/communities.js`
- `src/crg/cli/build.js`
- `src/crg/input-convergence.js`
- `src/crg/commands/review-context.js`
- `src/crg/graph.js`

## Test Gaps To Watch

- `src/cli/index.js`：主 CLI 分发没有 observed 单测直连。
- `src/cli/plugin.js`：高入度共享路径 helper 当前未见 observed 测试边。
- `src/crg/commands/review-context.js`：关键超长函数没有 observed 单测直连。

## Entrypoints Likely To Matter

- `src/cli/index.js`
- `src/crg/cli/router.js`
- `src/crg/cli/postprocess.js`
- `src/crg/commands/review-context.js`
- `src/crg/commands/detect-changes.js`

## Integrations

- `better-sqlite3`
- `tree-sitter`
- `simple-git`
