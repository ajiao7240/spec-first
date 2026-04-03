# YAML Frontmatter 架构

该目录中的`schema.yaml`是`spec:compound`编写的`docs/solutions/` frontmatter的规范合约。

使用此文件作为以下内容的快速参考：
- 必填字段
- 枚举值
- 验证期望
- 类别映射

## 必填字段

- **模块**：受问题影响的模块或区域
- **日期**：`YYYY-MM-DD` 中的 ISO 日期
- **问题类型**：`build_error`、`test_failure`、`runtime_error`、`performance_issue`、`database_issue`、`security_issue`、`ui_bug`、`integration_issue`、`logic_error`、`developer_experience`、`workflow_issue`之一， `best_practice`、`documentation_gap`
- **组件**：`rails_model`、`rails_controller`、`rails_view`、`service_object`、`background_job`、`database`、`frontend_stimulus`、`hotwire_turbo`、`email_processing`、`brief_system`、`assistant`之一， `authentication`、`payments`、`development_workflow`、`testing_framework`、`documentation`、`tooling`
- **症状**：具有 1-5 个具体症状的 YAML 数组
- **根本原因**：`missing_association`、`missing_include`、`missing_index`、`wrong_api`、`scope_issue`、`thread_violation`、`async_timing`、`memory_leak`、`config_error`、`logic_error`之一， `test_isolation`、`missing_validation`、`missing_permission`、`missing_workflow_step`、`inadequate_documentation`、`missing_tooling`、`incomplete_setup`
- **分辨率类型**：`code_fix`、`migration`、`config_change`、`test_fix`、`dependency_update`、`environment_setup`、`workflow_improvement`、`documentation_update`、`tooling_addition`、`seed_data_update`之一
- **严重性**：`critical`、`high`、`medium`、`low` 之一

## 可选字段- **rails_version**：`X.Y.Z` 格式的 Rails 版本
- **相关组件**：涉及的其他组件
- **标签**：搜索关键字，小写和连字符分隔

## 类别映射

- `build_error` -> `docs/solutions/build-errors/`
- `test_failure` -> `docs/solutions/test-failures/`
- `runtime_error` -> `docs/solutions/runtime-errors/`
- `performance_issue` -> `docs/solutions/performance-issues/`
- `database_issue` -> `docs/solutions/database-issues/`
- `security_issue` -> `docs/solutions/security-issues/`
- `ui_bug` -> `docs/solutions/ui-bugs/`
- `integration_issue` -> `docs/solutions/integration-issues/`
- `logic_error` -> `docs/solutions/logic-errors/`
- `developer_experience` -> `docs/solutions/developer-experience/`
- `workflow_issue` -> `docs/solutions/workflow-issues/`
- `best_practice` -> `docs/solutions/best-practices/`
- `documentation_gap` -> `docs/solutions/documentation-gaps/`

## 验证规则

1. 所有必填字段必须存在。
2. 枚举字段必须与允许的值完全匹配。
3. `symptoms` 必须是包含 1-5 项的 YAML 数组。
4. `date` 必须匹配 `YYYY-MM-DD`。
5. `rails_version`（如果存在）必须与 `X.Y.Z` 匹配。
