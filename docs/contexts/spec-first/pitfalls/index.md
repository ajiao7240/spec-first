# Pitfalls

## High-Risk Areas

- `src/crg/communities.js#function#writeCommunities#L71`：LOC=297，后处理阶段最大函数之一，改动容易影响 community 输出。 [medium]
- `src/crg/cli/build.js#function#runBuildAsync#L120`：LOC=250，覆盖图构建、parser 质量与 artifact 写入主流程。 [medium]
- `src/crg/input-convergence.js#function#collectInputFiles#L471`：LOC=243，聚合 ignore 与索引输入收敛规则。 [medium]
- `src/crg/commands/review-context.js#function#run#L30`：LOC=228，串联 diff 风险、候选测试与 graph expansion。 [medium]
- `src/crg/graph.js#function#resolveEdges#L106`：LOC=206，边解析出错会直接污染图质量。 [medium]
- `src/crg/cli/envelope.js#function#makeEnvelope#L20`：in_degree=19，几乎所有 CRG 命令共享输出封装。 [medium]
- `src/crg/cli/open-db.js#function#openDb#L13`：in_degree=14，多数 CRG 查询共用数据库入口。 [medium]

## External / Runtime Couplings

- `better-sqlite3`：本地图数据库持久化与查询引擎。
- `tree-sitter` + vendored grammars：多语言 AST 解析基础。
- `simple-git`：变更检测与 repo 状态读取依赖。

## Notes

- 当前 `unresolved_edge_count=2055`，说明 calls/imports 仍有较多未解析边。
- runtime asset 安装路径集中在 `src/cli/plugin.js` 与 adapters，路径调整容易影响 Claude/Codex 双宿主。
