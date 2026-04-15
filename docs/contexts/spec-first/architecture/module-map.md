# Module Map

## Communities

### crg/0

- 路径：`src/crg/`
- 职责：维护 AST 图数据库、查询、社区检测、风险分析与 postprocess。
- 证据：`crg communities` top community `crg/0`（31 files），`crg flow` 顶部链路集中在 postprocess/review-context/build。

### cli

- 路径：`src/cli/`
- 职责：负责 init/doctor/clean、平台适配、plugin manifest 同步与语言治理注入。
- 证据：`crg communities` top community `cli`（18 files），主入口 flow 为 `src/cli/index.js#function#runCli#L9`。

### skills

- 路径：`skills/`
- 职责：保存 workflow assets、模板与辅助脚本，作为运行时同步源。
- 证据：`crg communities` top community `skills`（11 files）。

### tests

- 路径：`tests/`
- 职责：提供 unit/contracts/smoke/integration/e2e 验证面，覆盖 CRG 与 CLI 关键链路。
- 证据：community 列表包含 `tests/0..tests/23`，且存在 tests → src 的跨社区 import 边。

## Data Shapes

- `package.json`（schema）：定义 CLI 包契约、bin 入口、scripts、依赖与发布边界。
- `skills/dspy-ruby/assets/signature-template.rb#class#Entity#L111`（entity）：DSPy Ruby 资产中的示例实体结构。

## Architecture Hints

- Top communities：`crg/0`、`cli`、`skills`
- Top hubs：`makeEnvelope`、`openDb`、`getBundledPath`
- 架构主轴是「CLI 控制面 + 内嵌 CRG 事实引擎 + workflow assets 同步源」。
