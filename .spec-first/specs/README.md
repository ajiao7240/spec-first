# `.spec-first/specs/`

这个目录承载 repo-level shared spec seeds。

当前第一版只包含：

- `repo-profile.yaml`

## add-only 规则

`spec-first init --claude` 与 `spec-first init --codex` 只会创建缺失的 seed：

- 文件不存在：创建
- 文件已存在：跳过
- 不 merge
- 不覆盖

因此，一旦文件进入项目维护阶段，CLI 不会持续自动重写它。

## scaffold 语义

`repo-profile.yaml` 是 repo-level shared scaffold，不是 repo truth engine。

- 自动写入只覆盖高置信度、低误导输入
- 空值表示“当前没有高置信度输入”
- 后续应由项目维护者按实际情况补全

## 维护边界

`repo-profile.yaml` 适合承载：

- 轻量项目身份与意图
- 项目长期原则
- 不可违反项
- review 默认关注点

`repo-profile.yaml` 不应该承载：

- workflow state
- transition rules
- quality gate state
- verifier dispatch
- task-specific requirements
- runtime routing rules

## 与 runtime 的关系

`.spec-first/specs/` 是 repo-level shared inputs，不属于 host runtime assets。

因此：

- 不纳入当前 managed state
- `clean --claude` 与 `clean --codex` 不删除该目录
