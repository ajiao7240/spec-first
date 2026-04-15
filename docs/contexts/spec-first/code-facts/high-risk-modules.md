# High-Risk Modules

## `src/crg/communities.js#function#writeCommunities#L71`

- Kind: `large_function`
- Severity: `medium`
- Why: LOC=297，后处理阶段最大函数之一，改动容易影响 community 输出。
- Evidence: `crg large-functions`

## `src/crg/cli/build.js#function#runBuildAsync#L120`

- Kind: `large_function`
- Severity: `medium`
- Why: LOC=250，覆盖图构建、parser 质量与 artifact 写入主流程。
- Evidence: `crg large-functions`

## `src/crg/input-convergence.js#function#collectInputFiles#L471`

- Kind: `large_function`
- Severity: `medium`
- Why: 输入收敛逻辑复杂，修改时容易影响索引边界。
- Evidence: `crg large-functions`

## `src/crg/cli/envelope.js#function#makeEnvelope#L20`

- Kind: `god_node`
- Severity: `medium`
- Why: in_degree=19，几乎所有 CRG 命令共享输出封装。
- Evidence: `crg god-nodes`

## `src/crg/cli/open-db.js#function#openDb#L13`

- Kind: `god_node`
- Severity: `medium`
- Why: in_degree=14，多数 CRG 查询共用数据库入口。
- Evidence: `crg god-nodes`
