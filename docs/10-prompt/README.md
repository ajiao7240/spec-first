# docs/10-prompt 说明

本目录保存历史 prompt / skill / agent 快照，用于研究、对照和翻译留档。

## 使用边界

- 本目录**不是**运行时 source-of-truth
- 本目录内容可能落后于当前 `skills/`、`agents/`、`templates/claude/commands/spec/` 的最新实现
- 若历史快照与当前运行时行为冲突，以仓库根目录下的 source-of-truth 为准
- 本目录有两个明确例外（是当前有效基线，不是历史快照，但都不是具体 runtime behavior contract）：
  - `结构化项目角色契约.md`：当前项目角色与演化判断基线
  - `系统性项目审查方法.md`：当前系统性项目审查的方法论基线（怎么编排/取证/收口一次项目级审查；与角色契约互补、与单视角审查 prompt 正交）

## 当前规范优先级

1. `docs/10-prompt/结构化项目角色契约.md`：角色与演化判断基线
2. `docs/10-prompt/系统性项目审查方法.md`：系统性项目审查方法论基线（冲突时让位于角色契约）
3. `skills/`：当前 skill 合同
4. `agents/`：当前 agent 合同
5. `templates/claude/commands/spec/`：Claude 命令模板
6. `docs/02-架构设计/02-目录结构.md`：当前目录结构与运行态布局说明
7. `CLAUDE.md` / `AGENTS.md`：宿主侧治理与语言规则

## 何时需要更新本目录

- 只有在需要同步历史快照、维护翻译版本或做版本对照时才更新
- 常规功能开发、路径迁移和运行时契约变更不要求同步修改本目录
