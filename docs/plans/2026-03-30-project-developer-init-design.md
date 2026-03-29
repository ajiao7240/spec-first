# 项目级 `.developer` 初始化设计

> **目标**：在 `spec-first init --claude` 执行时，为当前项目创建一个可追踪、可校验、可清理的项目级 `.developer` 文件，用来记录开发者身份与本次初始化的 CLI 版本。

## 背景

当前仓库已经支持两条互补的初始化路径：

- `spec-first init --global -u <name> --lang <zh|en>`
  - 作用范围是用户家目录
  - 写入全局身份文件 `~/.spec-first/.developer`
- `spec-first init --claude`
  - 作用范围是当前项目
  - 负责生成 `.claude/commands/spec/`、`.claude/skills/`、`.claude/agents/` 和 `.claude/spec-first/state.json`

现在缺少的是项目级开发者身份文件。没有这层文件时，项目初始化虽然完成了运行态资产同步，但无法在项目内留下“是谁、用什么语言偏好、用哪个 CLI 版本初始化”的稳定记录。

## 目标

1. 在 `spec-first init --claude` 时创建项目级 `.developer` 文件。
2. 文件内容固定、可读、便于排障和后续版本校验。
3. 文件必须跟随项目一起受管，能被 `doctor` 检查、被 `clean --claude` 清理。
4. 不破坏现有全局身份模型，不改变 `init --global` 的语义。
5. 为后续的项目初始化、升级回填、版本一致性检查保留扩展空间。

## 非目标

- 不把项目 `.developer` 变成新的全局身份配置。
- 不把 `init --claude` 改成强交互流程。
- 不在这一步引入复杂的多来源身份合并逻辑。
- 不改变现有 `.claude/commands/spec`、`.claude/skills`、`.claude/agents` 的生成模型。

## 推荐方案

### 1. 项目级 `.developer` 落盘位置

推荐放在：

```text
.claude/spec-first/.developer
```

理由：

- 和现有项目级状态文件 `.claude/spec-first/state.json` 同属一个受管命名空间
- 不会和其他 `.claude` 资产混在一起
- 便于后续 `doctor`、`clean`、升级回填统一处理

不推荐直接放在：

- `.claude/.developer`，容易和其他工具冲突
- `.spec-first/.developer`，当前项目已明确采用 `.claude` 作为 Claude 运行态目录

### 2. 文件格式

采用简单的 `key=value` 文本格式，和全局身份文件保持一致：

```text
name=kuang
lang=en
initialized_at=2026-03-30T12:34:56.789Z
version=1.3.12
```

字段说明：

- `name`
  - 开发者名称
  - 优先取 `spec-first init --claude -u <name>` 显式输入
- `lang`
  - 语言偏好
  - 允许值：`zh` / `en`
  - 优先取 `--lang`
- `initialized_at`
  - ISO 时间戳
  - 记录本次初始化写入时间
- `version`
  - 当前 CLI 版本
  - 取 `package.json` 中的版本号或现有 `VERSION` 常量

### 3. 初始化参数

建议给 `spec-first init --claude` 增加：

- `-u, --user <name>`
- `--lang <zh|en>`

推荐优先级：

1. 显式参数 `--user` / `--lang`
2. 全局身份文件 `~/.spec-first/.developer`
3. Git 配置 `git config user.name`
4. `lang` 默认值 `zh`

如果既没有显式参数，也没有全局身份，应该给出明确错误或提示，不要静默生成空值文件。

## 运行流程

### `spec-first init --claude`

建议按以下顺序执行：

1. 解析命令参数，读取 `--user`、`--lang`
2. 读取全局身份文件作为回退来源
3. 继续执行现有的 commands / skills / agents 同步逻辑
4. 写入 `.claude/spec-first/.developer`
5. 更新 `.claude/spec-first/state.json`
6. 打印初始化结果，提示重启 Claude Code

推荐写入时机：

- 在资产同步成功后再落盘 `.developer`
- 避免同步失败时留下“半成功”的身份文件

### `spec-first doctor`

`doctor` 需要新增一类检查：

- `.claude/spec-first/.developer` 是否存在
- `name`、`lang`、`initialized_at`、`version` 是否格式正确
- `version` 是否与当前 CLI 版本一致

检查结果建议：

- 缺失：`WARNING`
- 格式错误：`ERROR`
- 版本不一致：`WARNING` 并提示重新执行 `spec-first init --claude`

### `spec-first clean --claude`

`clean` 需要把项目级 `.developer` 当作受管资产一起清理：

- 删除 `.claude/spec-first/.developer`
- 删除 `.claude/spec-first/state.json`
- 保留用户手工放进 `.claude/` 的非受管内容

## 状态管理设计

当前 `state.json` 已经记录了：

- `commands`
- `skills`
- `agents`

建议在不破坏现有结构的前提下，增加一个项目身份分支，例如：

```json
{
  "manifestVersion": "1.3.12",
  "developer": {
    "path": ".claude/spec-first/.developer",
    "name": "kuang",
    "lang": "en",
    "initializedAt": "2026-03-30T12:34:56.789Z",
    "version": "1.3.12"
  },
  "commands": [...],
  "skills": [...],
  "agents": [...]
}
```

这样做的好处是：

- `doctor` 可以统一检查状态文件和项目身份文件
- `clean` 可以依据状态文件精确回收受管资产
- 未来升级时可以做版本一致性比较

## 兼容性策略

### 与全局身份兼容

全局身份仍然保留在：

```text
~/.spec-first/.developer
```

项目级初始化如果显式传了 `-u/--lang`，就直接使用显式值。

如果没有显式输入，则按以下顺序回退：

1. 全局身份文件
2. Git 配置
3. 默认语言 `zh`

### 与现有项目兼容

对于已经初始化过的项目：

- 重新执行 `spec-first init --claude` 时，应补写 `.claude/spec-first/.developer`
- 如果发现 `.claude/spec-first/state.json` 版本较旧，应同步更新身份文件中的 `version`
- 手工改动的 `.claude` 资产不应被误删

## 文件路径与最终产物

### 新增

- `.claude/spec-first/.developer`

### 继续保留

- `.claude/commands/spec/*.md`
- `.claude/skills/*`
- `.claude/agents/*`
- `.claude/spec-first/state.json`

### 不变

- `~/.spec-first/.developer`
  - 这是全局身份文件，不是项目级文件

## 测试方案

建议补以下测试：

1. `init --claude` 会生成 `.claude/spec-first/.developer`
2. `.developer` 内容包含 `name`、`lang`、`initialized_at`、`version`
3. `doctor` 能识别 `.developer` 缺失、格式错误、版本不一致
4. `clean --claude` 会删除 `.developer`
5. 重复执行 `init --claude` 时，`.developer` 内容可稳定重建
6. 全局 `.developer` 存在时，项目初始化可正常回退使用

## 风险与取舍

### 风险 1：身份文件和状态文件职责混淆

如果把 `.developer` 和 `state.json` 分开管理，但没有明确所有权，后续升级会出现“文件在，但 doctor 不认”或“doctor 认了，但 clean 不删”的情况。

**建议**：把 `.developer` 明确纳入受管状态，和 `state.json` 保持同一套生命周期。

### 风险 2：版本号频繁抖动

`version` 字段会在 CLI 发布新版本后变化，这会让老项目在 `doctor` 中出现版本不一致告警。

**建议**：把这类告警定义为 `WARNING`，而不是 `ERROR`，并把修复路径统一为 `spec-first init --claude`。

### 风险 3：与全局身份概念混淆

全局身份文件和项目身份文件都叫 `.developer`，容易被误解为同一层级。

**建议**：在文档和 `doctor` 输出中明确区分：

- `~/.spec-first/.developer` = 全局身份
- `.claude/spec-first/.developer` = 项目身份

## 结论

推荐把项目级 `.developer` 文件纳入 `spec-first init --claude` 的标准产物，并放到 `.claude/spec-first/.developer`。

这是当前最稳的做法，因为它：

- 保持了 `init --global` 与 `init --claude` 的职责分离
- 和现有 `state.json` 命名空间一致
- 便于 `doctor`、`clean`、升级回填统一治理
- 不会破坏当前 `npm CLI + project-local .claude assets` 模型

如果后续要继续扩展，可以在这份设计的基础上再加：

- 项目级身份回退链
- 自动版本提示
- 与任务/工作流日志的关联索引
