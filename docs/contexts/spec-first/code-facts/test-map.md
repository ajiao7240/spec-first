# Test Map

## Test Files

- `tests/contracts/crg-cli-v1.test.js` (integration) -> `docs/contracts/crg-cli-v1.schema.json`
  - 摘要：验证 CRG CLI v1 schema 与命令输出契约。
- `tests/unit/crg-router.test.js` (unit) -> `src/crg/cli/router.js`
  - 摘要：验证 CRG router 命令路由行为。
- `tests/unit/crg-build-cli.test.js` (unit) -> `src/crg/cli/build.js`
  - 摘要：验证 build/stats 等 CLI handler 行为。
- `tests/unit/crg-input-convergence.test.js` (unit) -> `src/crg/input-convergence.js`
  - 摘要：验证输入收敛、ignore 与 iOS Pod 过滤规则。
- `tests/unit/crg-incremental.test.js` (unit) -> `src/crg/incremental.js`
  - 摘要：验证指纹增量检测与删除/回滚边界。

## Coverage Gaps

- `src/cli/index.js`：当前 graph evidence 未显示 tests 直接导入主 CLI 总入口，主要依赖 smoke/integration 脚本验证。 [medium]
- `src/cli/plugin.js`：高入度共享热点，但当前未见 observed 测试边直连。 [medium]
- `src/crg/commands/review-context.js`：关键超长函数，目前没有 observed 单测直连该模块。 [medium]
