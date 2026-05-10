# Archive And Historical Search Index

本索引用于处理 `docs/` 中的历史方案、CE 对比、旧 CRG 设计和阶段性审查材料。它不是新的 architecture source of truth，而是搜索命中历史词汇时的判读入口。

## Current Source Of Truth

当前实现、workflow 和 graph/provider 边界优先以这些位置为准：

- 项目入口：`README.md`、`README.zh-CN.md`
- 文档总索引：`docs/README.md`
- 用户手册：`docs/05-用户手册/`
- 当前 contract：`docs/contracts/`
- 角色与演化判断基线：`docs/10-prompt/结构化项目角色契约.md`
- source assets：`skills/`、`agents/`、`templates/`、`src/cli/`
- graph/provider setup：`spec-mcp-setup`、`spec-graph-bootstrap`
- 版本事实：`CHANGELOG.md`、`package.json`

## Risky Historical Tokens

搜索命中以下词汇时，默认先按历史输入处理，不能直接当作当前实现依据：

- `src/crg`
- `spec-first crg`
- `graph.db`
- `better-sqlite3`
- `.claude-plugin`
- `CRG Stage-0`
- `ECC`
- `compound-engineering-plugin`

## Search Result Rule

1. 如果命中文档位于 `docs/项目介绍/**`，先看该文档顶部是否有 `Lifecycle: historical-input / external-reference` banner。
2. 如果命中文档位于 `docs/业界分析/**`，把它当作 CE/竞品/历史对比材料，只能提供背景或迁移判断输入。
3. 如果命中文档提到 `src/crg`、`graph.db` 或 `better-sqlite3`，必须回到 `docs/README.md` 的 `Legacy CRG / ECC 搜索边界` 和当前 graph/provider source 复核。
4. 如果命中文档提到 `.claude-plugin`，必须回到 `src/cli/contracts/dual-host-governance/**`、`src/cli/plugin.js` 和当前 README 复核 runtime delivery 边界。
5. 如果命中文档提到 `ECC`，只有当前 `skills/spec-app-consistency-audit/`、`agents/` 或 tests 仍有 source evidence 时，才可作为当前实现依据。

历史材料保留的价值是解释演化背景、迁移取舍和拒绝边界；它们不能覆盖当前 source、contract、CLI 或 generated runtime 治理规则。
