# 非 bootstrap skill 控制面路径迁移到 `.spec-first/workflows/`

> **来源**：2026-04-13 artifact-path-standardization 重构期间，决策将以下 6 个 skill 的控制面迁移延后，作为独立任务处理（见 `docs/plans/2026-04-13-003-refactor-artifact-path-hard-cut-plan.md` Scope Boundaries）。

## 待迁移 Skill 列表

| Skill | 当前写入路径（旧） | 目标路径（新） |
|-------|-------------------|----------------|
| `spec-review` | `.context/spec-first/spec-review/<slug>/` | `.spec-first/workflows/spec-review/<slug>/` |
| `spec-plan` | `.context/spec-first/spec-plan/<slug>/` | `.spec-first/workflows/spec-plan/<slug>/` |
| `todo-create` | `.context/spec-first/todo-create/<slug>/` | `.spec-first/workflows/todo-create/<slug>/` |
| `todo-triage` | `.context/spec-first/todo-triage/<slug>/` | `.spec-first/workflows/todo-triage/<slug>/` |
| `todo-resolve` | `.context/spec-first/todo-resolve/<slug>/` | `.spec-first/workflows/todo-resolve/<slug>/` |
| `feature-video` | `.context/spec-first/feature-video/<slug>/` | `.spec-first/workflows/feature-video/<slug>/` |

> 注：实际写入路径以各 skill 的 `SKILL.md` 为准，上表为推断值，实施前需核查。

## 背景

2026-04-13 的 artifact-path 硬切换重构（`docs/plans/2026-04-13-003-refactor-artifact-path-hard-cut-plan.md`）仅聚焦 bootstrap + graph-bootstrap 的控制面迁移。可行性审查发现上述 6 个 skill 同样写入 `.context/spec-first/<workflow>/`，属于相同的路径命名空间问题，但将其纳入当前重构会显著扩大 scope，因此延后处理。

当前状态：`.context/` 目录在 2026-04-13 重构完成后，将只剩上述 6 个 skill 的控制面路径仍在使用旧命名空间，形成一个孤立残留。

## 目标

将上述 6 个 skill 的控制面路径统一迁移到 `.spec-first/workflows/<workflow>/<slug>/`，彻底清除 `.context/` 作为运行时目录的残留。

## 前置条件

- `docs/plans/2026-04-13-003-refactor-artifact-path-hard-cut-plan.md` 对应的硬切换重构已完成并合并。
- `.spec-first/` 已成为隐藏运行态产物的统一根目录。

## 实施要求

### 1. 核查各 skill 实际写入路径

对每个 skill 的 `SKILL.md` 执行 grep，确认当前控制面路径模式，记录实际写入的目录格式与文件名列表：

```bash
grep -n "\.context/" skills/spec-review/SKILL.md
grep -n "\.context/" skills/spec-plan/SKILL.md
grep -n "\.context/" skills/todo-create/SKILL.md
grep -n "\.context/" skills/todo-triage/SKILL.md
grep -n "\.context/" skills/todo-resolve/SKILL.md
grep -n "\.context/" skills/feature-video/SKILL.md
```

### 2. 路径硬切换

- 将各 skill `SKILL.md` 及其 references 中的 `.context/spec-first/<workflow>/` 改为 `.spec-first/workflows/<workflow>/`。
- 不保留旧路径 fallback，不引入兼容读取逻辑。
- 只改 source-of-truth（`skills/`），不手改 `.claude/` 运行时副本。

### 3. 同步更新 `.gitignore`

确认 `.gitignore` 中已覆盖 `.spec-first/`（2026-04-13 重构中已添加），无需单独为这 6 个 workflow 补充条目。

### 4. 更新正式文档

对以下文档中引用这 6 个 skill 控制面路径的部分，同步切换为新路径：

- `docs/02-架构设计/02-目录结构.md`
- `docs/05-用户手册/02-核心概念.md`
- 其他明确描述上述 skill 控制面产物布局的有效规范文档

### 5. 验证

- smoke 测试 grep 验证：安装后的 runtime skill 资产中，上述 6 个 skill 的控制面路径描述已切换为 `.spec-first/workflows/<workflow>/`。
- repo-wide sweep：`.context/` 在仓库正式源码与文档中不再出现为运行时正式目录。

## 验收标准

1. 上述 6 个 skill 的 `SKILL.md` 及其 references 中，控制面路径全部切换为 `.spec-first/workflows/<workflow>/<slug>/`。
2. `.context/` 在仓库正式文档和 source-of-truth skill 文件中不再被描述为当前运行时目录。
3. smoke 测试通过：安装后的 runtime 副本使用新路径。
4. `CHANGELOG.md` 记录本次迁移。

## 关联文档

- 主重构计划：[docs/plans/2026-04-13-003-refactor-artifact-path-hard-cut-plan.md](/Users/kuang/xiaobu/spec-first/docs/plans/2026-04-13-003-refactor-artifact-path-hard-cut-plan.md)
- 设计方案：[docs/plans/2026-04-13-002-artifact-path-standardization-design.md](/Users/kuang/xiaobu/spec-first/docs/plans/2026-04-13-002-artifact-path-standardization-design.md)
