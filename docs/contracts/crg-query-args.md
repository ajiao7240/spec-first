# crg query 参数矩阵

本文档定义 `crg query` 命令的 8 种 pattern 与各自的必填参数和非法组合约束。

## 参数说明

| 参数 | 类型 | 说明 |
|------|------|------|
| `--pattern` | string (required) | 查询模式，见下表 8 种 |
| `--symbol` | string | 目标符号名（函数名、类名等） |
| `--module` | string | 目标模块路径（文件路径或包名） |
| `--subject` | string | 目标主体（用于 tests_for 模式） |

## pattern × 参数矩阵

| pattern | 必填参数 | 非法组合 | 违规时退出码 |
|---------|---------|---------|------------|
| `callers_of` | `--symbol` | 使用 `--module` | exit 1 |
| `callees_of` | `--symbol` | 使用 `--module` | exit 1 |
| `importers_of` | `--module` | 使用 `--symbol` | exit 1 |
| `importees_of` | `--module` | 使用 `--symbol` | exit 1 |
| `tests_for` | `--subject` | 使用 `--symbol` 或 `--module` | exit 1 |
| `similar_to` | `--symbol` | 使用 `--module` | exit 1 |
| `dependents_of` | `--module` | 使用 `--symbol` | exit 1 |
| `dependencies_of` | `--module` | 使用 `--symbol` | exit 1 |

## 合法调用示例

```bash
# callers_of：查询谁调用了 parseConfig
crg query --pattern callers_of --symbol parseConfig

# callees_of：查询 bootstrap 调用了哪些函数
crg query --pattern callees_of --symbol bootstrap

# importers_of：查询谁导入了 src/utils/logger.js
crg query --pattern importers_of --module src/utils/logger.js

# importees_of：查询 src/cli/init.js 导入了哪些模块
crg query --pattern importees_of --module src/cli/init.js

# tests_for：查询 src/crg/builder.js 对应的测试
crg query --pattern tests_for --subject src/crg/builder.js

# similar_to：查询与 buildGraph 结构相似的函数
crg query --pattern similar_to --symbol buildGraph

# dependents_of：查询哪些模块依赖了 src/crg/index.js
crg query --pattern dependents_of --module src/crg/index.js

# dependencies_of：查询 src/crg/index.js 的所有依赖
crg query --pattern dependencies_of --module src/crg/index.js
```

## 非法调用示例（均 exit 1）

```bash
# callers_of 不允许使用 --module
crg query --pattern callers_of --module src/utils/logger.js  # exit 1

# importers_of 不允许使用 --symbol
crg query --pattern importers_of --symbol parseConfig  # exit 1

# tests_for 不允许使用 --symbol 或 --module
crg query --pattern tests_for --symbol parseConfig  # exit 1
crg query --pattern tests_for --module src/utils/logger.js  # exit 1
```

## 退出码约定

| 退出码 | 含义 |
|--------|------|
| 0 | 成功，输出 JSON envelope |
| 1 | 参数错误（缺少必填参数、使用了非法组合参数） |
| 2 | 图未构建（需先运行 `crg build`） |
| 3 | 内部错误（图数据损坏或不可访问） |
