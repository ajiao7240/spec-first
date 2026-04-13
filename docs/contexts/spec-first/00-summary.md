# spec-first

- 语言/运行时：JavaScript / Node.js >= 20
- 形态：single-package-cli
- 主要框架：Node.js CLI、Jest、CRG
- 图谱状态：CRG Full 模式，528 nodes / 1307 edges

## 这是什么

spec-first 是一个 npm 分发的 Node.js CLI，用来安装、同步和维护 Claude Code / Codex 的 workflow 资产，并提供本地 CRG（Code Relationship Graph）命令来做 build、search、flows、impact、review-context 等分析。

## 关键入口

- `bin/spec-first.js`：CLI bin entry that dispatches into src/cli and CRG router
- `src/crg/cli/router.js`：Dispatches CRG subcommands such as build, stats, search and review-context
- `src/crg/cli/postprocess.js`：run -> resolveGraphDb -> requireSqlite -> initDatabase
- `src/cli/index.js`：runCli -> printHelp -> printVersion -> maybeShowVersionReminder
- `src/crg/commands/review-context.js`：run -> openDb -> detectChanges -> isSensitiveFile
- `src/crg/commands/detect-changes.js`：run -> openDb -> detectChanges -> makeEnvelope

## 测试与风险

- 测试主要分布在 `tests/unit`、`tests/smoke`、`tests/integration`、`tests/e2e`、`tests/contracts`。
- 高风险集中在 CRG 构建/后处理和共享 envelope/path helper。
- CLI 主入口与 init/doctor 更多依赖脚本级验证，直接 `tests_for` 映射偏少。
