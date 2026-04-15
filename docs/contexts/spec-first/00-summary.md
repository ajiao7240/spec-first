# spec-first

- 语言/运行时：JavaScript / Node.js >= 20
- 形态：single-package CLI repository
- 主要框架：Node.js CLI、Jest、tree-sitter、better-sqlite3
- 图谱状态：CRG Full 模式，528 nodes / 1307 edges

## 这是什么

spec-first 是一个 npm 分发的 Node.js CLI，用来安装、同步和维护 Claude Code / Codex 的 workflow 资产，并内嵌 CRG（Code Relationship Graph）运行时，用于 build、search、flows、impact、review-context 等工程事实分析。

## 关键入口

- `src/cli/index.js`：主 CLI 入口，分发 help/version/doctor/init/clean
- `src/crg/cli/router.js`：CRG 子命令总入口，路由 build/stats/search/review-context 等 17 个子命令
- `src/crg/cli/postprocess.js`：CRG 后处理入口，串联 communities/flows/analyze/rebuildFTS
- `src/crg/commands/review-context.js`：变更审查上下文入口，联动 detectChanges 与 reverse BFS
- `src/crg/commands/detect-changes.js`：按 git diff 计算受影响节点与风险

## 测试与风险

- 测试主体集中在 `tests/unit`、`tests/contracts`、`tests/smoke`、`tests/integration`、`tests/e2e`。
- 高风险热点集中在 CRG 构建/后处理、共享 envelope/open-db helper，以及输入收敛逻辑。
- 当前 unresolved edge 仍有 2055 条，图谱结论应和源码读取、脚本验证交叉确认。
