# Agent Workflow Patterns

## 概述

这些模式不是 spec-bootstrap 独有的实现细节，而是从它的执行方式里提炼出来的通用工作流规范。它们的价值在于把“默认会这么做”的经验写成可引用、可复用、可审查的规则。

## 1. PRD Task Contract

### 定义

主控先生成任务合同（PRD），worker 只消费这份合同，不接受口头补充指令。PRD 是单一事实来源。

### 动机

这样可以把编排器的意图固定下来，减少 session 之间的歧义，也让 worker 在不理解全局上下文的情况下仍然能稳定执行。

### 应用场景

- 多个 worker 并行产出不同上下文文档
- 任务需要跨 session 延续，但执行约束必须保持一致
- 审查时需要追溯“worker 当时到底拿到了什么”

### 实现示例

- `skills/spec-bootstrap/SKILL.md` 的 Phase 2 PRD 生成流程
- `.context/spec-first/bootstrap/<slug>/tasks/<task-id>/prd.md`
- `skills/spec-bootstrap/references/prd-template.md`

## 2. File Ownership Boundary

### 定义

用输出文件边界替代口头职责边界。每个 worker 只对自己声明的文件负责，文件列表就是责任范围。

### 动机

边界可以机械检测，避免多个 worker 写同一文件，也避免“我以为你会改”的职责漂移。

### 应用场景

- summary / architecture / pitfalls / layer / database 任务并行执行
- README 汇总由主控独占，避免与 worker 交叉写入
- 需要把失败定位到具体产物，而不是笼统地归因给某个阶段

### 实现示例

- `skills/spec-bootstrap/SKILL.md` 的 `### 3.1 File Ownership Rules`
- `skills/spec-bootstrap/references/prd-template.md` 的 `Files to Fill`
- `skills/spec-bootstrap/references/database-prd-template.md` 的 `Files to Fill`

## 3. Conditional Generation

### 定义

先检测，再生成；有证据才产出，没有证据就不生成空模板。

### 动机

上下文资产应该反映真实代码库状态，而不是把模板填满。检测驱动的生成可以减少空洞内容和误导性文档。

### 应用场景

- 只有检测到某个层时才创建对应 layer context
- 只有 MySQL 配置和连接验证通过时才创建 database context
- 某个目录没有足够证据时，允许跳过而不是硬造文件

### 实现示例

- `skills/spec-bootstrap/SKILL.md` 的 Phase 1 layer detection
- `skills/spec-bootstrap/SKILL.md` 的 `database-context` 条件触发
- `skills/spec-bootstrap/references/prd-template.md` 的 `Context` 填充规则

## 4. Multi-Level Degradation

### 定义

工具能力不足时按能力降级到下一层，不因为高阶工具不可用就整体失败。每一级都有明确标记和可接受的产出质量。

### 动机

目标是尽量产出可靠上下文，而不是把执行结果绑定在某个特定工具集上。

### 应用场景

- Full / Enhanced / Basic 三档分析模式
- MySQL 的 MCP / CLI / ORM inference 三档数据库访问
- 网络或配置不可用时仍保留可验证的最小输出

### 实现示例

- `skills/spec-bootstrap/SKILL.md` 的 Analysis Mode Detection
- `skills/spec-bootstrap/SKILL.md` 的 Database Configuration Detection
- `skills/spec-bootstrap/references/database-prd-template.md` 的 DB access level 标记

## 5. Failure Recovery

### 定义

重跑前先备份已有产物，成功后删除备份；失败时根据失败类型选择恢复完整备份或保留部分成果。

### 动机

重新生成上下文资产时，不能冒然覆盖已有工作。恢复策略必须可回滚，也要允许部分成功时保留有效成果。

### 应用场景

- 目标项目已有旧的 `docs/contexts/<slug>/` 产物
- summary-context 失败需要全量回滚
- 非 summary 任务失败时保留已完成文件，避免浪费成功产出

### 实现示例

- `skills/spec-bootstrap/SKILL.md` 的 R20 backup policy
- `skills/spec-bootstrap/SKILL.md` 的 `### 3.4 Assembly`
- `skills/spec-bootstrap/SKILL.md` 中对 `summary-context` 和其他 worker 的不同恢复策略

## 跨工作流引用

这些模式可被其他 workflow 直接引用，例如：

- `spec-review` 可以引用 `Failure Recovery` 和 `File Ownership Boundary` 来定义复审边界
- `spec-work` 可以引用 `PRD Task Contract` 来约束 worker 的输入输出
- `spec-bootstrap` 之外的文档化流程也可以复用 `Conditional Generation` 和 `Multi-Level Degradation`

它们的作用是把已经验证过的执行方式沉淀为可复用规范，而不是只留在某一个 skill 的提示词里。
