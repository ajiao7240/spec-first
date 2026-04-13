# Pitfalls

## High-Risk Areas

- `src/crg/communities.js`：writeCommunities is the largest function in the repo and central to CRG postprocess output generation. [high]
- `src/crg/cli/build.js`：runBuildAsync is a wide orchestration function that spans graph build, parser quality and artifact writes. [high]
- `src/crg/input-convergence.js`：collectInputFiles aggregates multiple file-selection rules and ignore logic, making it error-prone when changing indexing behavior. [medium]
- `src/crg/cli/envelope.js`：makeEnvelope is the highest in-degree helper and affects nearly every CRG command response shape. [high]
- `src/cli/plugin.js`：getBundledPath is a high fan-in helper inside runtime asset installation, so path changes can ripple across multiple commands. [medium]
- `src/cli/index.js`：The primary CLI dispatch flow is covered by smoke/integration scripts but has no direct tests_for match in the graph. [medium]

## External / Runtime Couplings

- `src/crg/migrations.js`：CRG persistence and queries rely on better-sqlite3 for the local graph database.
- `src/crg/input-convergence.js`：Input convergence uses ignore to honor repo ignore rules while selecting files for indexing.
- `src/crg/lang-config.js`：CRG language support is configured around tree-sitter grammar packages, including vendored Swift/ObjC grammars.
- `tests/contracts/crg-cli-v1.test.js`：Contract and unit tests use Jest mocks/spies around CRG and CLI modules.

## Notes

- better-sqlite3 和 tree-sitter 是 CRG 的关键原生依赖。
- runtime asset 安装路径集中在 `src/cli/plugin.js` 与 adapters，变更容易影响 Claude/Codex 双宿主。
- CRG build 虽可用，但 unresolved edge 仍然较高，做图谱结论时优先结合源码与测试交叉确认。
