# 已知风险与注意事项

> 来源: risk-signals.json + fact-inventory.integrations  
> 分析模式: Full | 生成时间: 2026-04-23

## 高风险文件

### `src/crg/parser.js`（1910 LOC）⚠️ HIGH

**风险**: AST 解析器核心，17 语言解析逻辑全集中于此。

- 任何修改都可能影响所有语言的图索引正确性
- tree-sitter binding 升级时需全量回归 `tests/e2e/crg-all-commands.sh`
- native module（better-sqlite3）打包与此文件中的 tree-sitter 绑定共同构成安装时最容易失败的路径
- **关联**: `bin/postinstall.js#probeBetterSqlite` 会在安装时检测 native module 状态

## 中等风险节点

### `makeEnvelope`（`src/crg/cli/envelope.js`，in_degree=19）

**风险**: 所有 CRG 命令的 JSON 输出格式通过此函数，修改 envelope schema 是破坏性变更。

- 消费方依赖 `schema_version: "crg-cli/v1"` 和 `degraded` 字段
- 测试覆盖检测未发现直接单测，建议 `tests/contracts/crg-cli-v1.test.js` 中补充

### `normalizeStage`（`src/context-routing/profiles.js`，in_degree=15）

**风险**: context-routing 全模块的 stage 规范化函数，影响所有路由决策。

- `plan / work / review / unknown` 四个合法值；新增 stage 时需同步更新此函数

### `openDb`（`src/crg/cli/open-db.js`，in_degree=14）

**风险**: CRG 全部数据库访问统一入口，修改影响所有 SQLite 操作。

- better-sqlite3 为 optionalDependency：`openDb` 需容错处理 module 缺失的情况
- `src/crg/migrations.js#initDatabase` 在 `openDb` 之后执行 schema 迁移

## 集成风险

| 依赖 | 版本 | 风险点 |
|------|------|--------|
| `better-sqlite3` | ~12.6.0 (optional) | native module 需要与 Node.js 版本匹配编译；CI 需测试 prebuilt 和自编译两条路径 |
| `tree-sitter` | ~0.21.0 | 与 17 个语言 grammar 包的版本矩阵需严格锁定；升级时全部 grammar 需同步 |
| `simple-git` | ~3.0.0 | git 操作在 CI 中依赖 git binary 可用性；部分 Docker 镜像缺少 git |

## 架构决策风险

**高 unresolved edge rate（55.6%）**：CRG 自身的图索引有 4803 条无法解析的跨模块边，主要来自：
- Node.js 内置模块（`node:path`、`json`、`sys` 等 Python stdlib imports）
- 跨 npm package 的调用（better-sqlite3、simple-git）
- `.mjs` ESM 模块中的动态 import

这导致 `tests_for` 和 `crg impact` 等基于图遍历的命令在此仓库上返回值偏低，不代表测试覆盖不足。

## 常见陷阱

1. **不要直接编辑 `.claude/` 或 `.codex/` 下的运行时资产**：这些是 `spec-first init` 生成的产物，重新 init 会覆盖手动修改。
2. **`spec-first graph-bootstrap` 不是包级子命令**：`/spec:graph-bootstrap` 是安装后宿主工作流入口。
3. **修改 skill/agent 后必须重新 `spec-first init`**：源码在 `skills/`，运行时在 `.claude/skills/`，两者不自动同步。
4. **CHANGELOG.md 是必填项**：任何源码变更都必须同步在 `CHANGELOG.md` 中添加记录。
