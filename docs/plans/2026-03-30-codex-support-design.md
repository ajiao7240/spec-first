# Spec-First Codex 支持技术方案

> **目标**：在不推翻当前 `npm install -g spec-first` + `spec-first init --claude` 主链路的前提下，增加对 Codex 的支持能力，并把仓库从“Claude-only 运行态”演进为“统一资产源 + 多平台适配器”的结构。

## 1. 背景

当前 `spec-first` 的实现已经形成了一条稳定链路：

- `npm install -g spec-first`
- `spec-first doctor`
- `spec-first init --claude`
- 项目内生成 `.claude/commands/spec/`、`.claude/skills/`、`.claude/agents/`、`.claude/spec-first/state.json` 和 `.claude/spec-first/.developer`

代码层面可以看到几个关键事实：

- CLI 入口在 `src/cli/index.js`
- 初始化逻辑集中在 `src/cli/commands/init.js`
- 资产同步逻辑集中在 `src/cli/plugin.js`
- 受管状态与 `.developer` 记录集中在 `src/cli/state.js` 和 `src/cli/developer.js`
- `.claude-plugin/plugin.json` 当前是统一资产清单，但不是运行时目录

这套设计对 Claude Code 已经足够稳定，但它天然带有 Claude 运行态偏置：

- 同步目标目录写死为 `.claude/...`
- `init` 只接受 `--claude`
- `state.json`、`.developer` 都默认落在 `.claude/spec-first/`
- 运行态内容转换逻辑是 Claude 专用的

如果要支持 Codex，最合理的方向不是推翻现有 Claude 链路，而是把“平台差异”抽到独立适配层里。

## 2. 目标

### 2.1 一期目标

1. 保持现有 Claude 链路不变。
2. 抽出统一的“平台适配器”抽象。
3. 让 `spec-first` 能针对不同平台生成不同的项目运行态。
4. 为 Codex 预留独立的初始化、诊断、清理和运行态目录。

### 2.2 二期目标

1. 让 `doctor / init / clean` 具备平台选择能力。
2. 让同一套 canonical 资产可以被 Claude、Codex、未来更多平台复用。
3. 把平台差异限制在“目标目录、内容转换、诊断规则”三层，不污染 canonical 源码资产。

## 3. 设计原则

### 3.1 canonical 资产不变

仓库中的这些目录继续作为单一事实来源：

- `templates/`
- `skills/`
- `agents/`
- `.claude-plugin/plugin.json`

这些内容不应该因为 Codex 的加入而被改成某个平台专用格式。

### 3.2 运行态由适配器生成

所有平台差异都放到运行态生成阶段：

- 目标目录
- 目录名和文件名映射
- skill 内容中的 agent 引用转换
- state 文件路径
- developer 元数据路径

### 3.3 现有 Claude 不退化

Codex 支持必须是“增加能力”，不是“改坏 Claude”。

### 3.4 平台边界显式化

不要把平台判断散落在各个命令里。  
`init / doctor / clean / state` 应该通过同一层平台适配器来工作。

## 4. 方案选型

### 方案 A：在现有代码里硬加 `--codex` 分支

做法：

- `init.js` 里增加 `--codex`
- `plugin.js` 里根据平台选择不同同步路径
- `state.js` 里按平台拼接不同目录

优点：

- 改动快
- 初期实现量小

缺点：

- 平台逻辑会散落在多个文件
- Claude 和 Codex 的差异会越来越难维护
- 后续扩平台时会继续复制 if/else

### 方案 B：引入统一平台适配器层

做法：

- 定义 `platform adapter` 接口
- Claude 和 Codex 各自实现一份 adapter
- `init / doctor / clean` 只调用 adapter，不直接写死目录和转换规则

优点：

- 代码结构清晰
- 适合多平台扩展
- 运行态差异集中管理

缺点：

- 初期重构量比方案 A 大
- 需要调整部分现有函数签名

### 方案 C：直接做完整 plugin-first / marketplace 模型

做法：

- 把 `spec-first` 变成一个真正的多平台插件包
- 在平台侧注册 `spec-first` namespace
- 让不同平台通过插件发现资产

优点：

- 理论上最统一

缺点：

- 改造面最大
- 会重做安装、发现、命名空间、验证链路
- 对当前仓库来说风险明显更高

### 推荐

推荐 **方案 B**。

原因很直接：

- 它和当前仓库已经存在的“canonical 资产 + 运行态同步”模型兼容。
- 它能先把 Claude 逻辑收口，再自然接入 Codex。
- 它为未来 `init --codex`、`doctor --codex`、`clean --codex` 留出了稳定扩展点。

## 5. 目标架构

### 5.1 三层结构

```text
canonical assets
  ├── templates/
  ├── skills/
  ├── agents/
  └── .claude-plugin/plugin.json

platform adapter
  ├── Claude adapter
  ├── Codex adapter
  └── future adapters

project runtime
  ├── platform-specific commands
  ├── platform-specific skills
  ├── platform-specific agents
  ├── platform-specific state
  └── platform-specific developer metadata
```

### 5.2 平台适配器职责

每个 adapter 需要负责这些事情：

- 返回自己的运行态根目录
- 返回 commands / skills / agents / state / developer 的具体路径
- 定义内容转换规则
- 定义可诊断的资产集合
- 定义清理逻辑
- 定义打印输出中的平台名称

### 5.3 建议的适配器接口

```js
{
  id: 'claude' | 'codex',
  runtimeRoot: '.claude' | '.codex',
  managedRoot: '.claude/spec-first' | '.codex/spec-first',
  commandRoot: '.claude/commands/spec' | '.codex/commands/spec',
  skillsRoot: '.claude/skills' | '.codex/skills',
  agentsRoot: '.claude/agents' | '.codex/agents',
  stateFile: '.claude/spec-first/state.json' | '.codex/spec-first/state.json',
  developerFile: '.claude/spec-first/.developer' | '.codex/spec-first/.developer',
  transformSkillContent(content) { ... },
  transformAgentContent(content) { ... },
  inspect(projectRoot) { ... },
}
```

## 6. 当前代码如何演进

### 6.1 `src/cli/index.js`

当前入口只认：

- `doctor`
- `init`
- `clean`

建议改造为：

- `doctor` 支持平台参数，或者自动识别当前项目平台
- `init` 支持 `--claude` 和 `--codex`
- `clean` 支持 `--claude` 和 `--codex`

短期内为了兼容现有用户，可以继续保留 `--claude`，Codex 只新增一个并行入口：

- `spec-first init --claude`
- `spec-first init --codex`

### 6.2 `src/cli/commands/init.js`

当前 `init` 的问题是：

- 平台固定为 Claude
- 目标目录固定为 `.claude`
- 资产同步调用固定为 Claude runtime transform
- `.developer` 写入路径固定在 `.claude/spec-first/.developer`

建议把 `init` 重构成：

1. 解析平台参数
2. 获取 adapter
3. 读取 bundled manifest
4. 解析开发者身份
5. 调用 adapter 的 `sync` 逻辑
6. 写入平台对应的 `state.json`
7. 写入平台对应的 `.developer`

这样 `init` 本身不再关心平台细节。

### 6.3 `src/cli/commands/doctor.js`

当前 `doctor` 的检查也偏 Claude：

- 检查 `.claude/commands/spec`
- 检查 `.claude/skills`
- 检查 `.claude/agents`
- 检查 `.claude/spec-first/.developer`
- 检查 `.claude/spec-first/state.json`

建议将检查逻辑下沉给 adapter：

- Claude adapter 检查 `.claude/...`
- Codex adapter 检查 `.codex/...`

这样未来 `doctor --codex` 只需要换 adapter，不需要重写检查器。

### 6.4 `src/cli/commands/clean.js`

当前 `clean --claude` 清理的是 Claude 运行态。

Codex 支持后应该具备：

- `clean --claude`
- `clean --codex`

两者都通过 adapter 的 `removeManagedAssets()` 完成。

### 6.5 `src/cli/plugin.js`

这是当前最关键的改造点。

现在 `plugin.js` 已经承担了：

- manifest 读取
- bundled commands / skills / agents 的发现
- 资产同步
- Claude 内容转换

Codex 支持后，建议把它拆成两层：

1. **asset layer**  
   只负责读取 canonical 资产，不关心平台。

2. **adapter layer**  
   负责把 canonical 资产渲染到具体平台运行态。

也就是说，`plugin.js` 不应该再写死“Claude 运行态内容转换”，而应该接收一个 adapter 注入的 transform 函数。

### 6.6 `src/cli/state.js`

现在 `state.js` 默认认为运行态根目录是 `.claude/spec-first`。

Codex 支持后，建议把以下内容参数化：

- state 文件路径
- developer 文件路径
- managed asset 目录根

`state` 的结构本身可以保留不变，只需要把路径和平台信息外置。

## 7. Codex 目标的落地方式

### 7.1 最小可行版本

最小可行版本不是“立即全面支持 Codex 所有特性”，而是：

- 允许 `spec-first init --codex`
- 生成 Codex 专属运行态目录
- 复用同一套 canonical assets
- 支持 `doctor` / `clean`

### 7.2 平台运行态目录

建议 Codex 使用与 Claude 平行的目录层级：

```text
.codex/
  ├── commands/
  ├── skills/
  ├── agents/
  └── spec-first/
      ├── state.json
      └── .developer
```

如果 Codex 官方约定的运行态路径与这里不同，只需要在 adapter 中调整，不影响 canonical 资产层和命令编排层。

### 7.3 内容转换策略

对于 Claude，当前已有一套转换逻辑：

- 复制 skill 文件时执行 runtime content transform
- 复制 agent 文件时执行 runtime content transform

Codex 版本应该保留同样的“复制 + 转换”模式，只是转换规则由 Codex adapter 决定。

常见转换点包括：

- 运行态 skill 引用格式
- 运行态 agent 引用格式
- 平台专属命令说明
- 平台专属路径前缀

## 8. 兼容性策略

### 8.1 保持 Claude 默认不变

现有用户依旧执行：

```bash
spec-first init --claude
```

不应该因为 Codex 的加入而要求用户改用新的默认参数。

### 8.2 Codex 作为新平台入口

新入口建议是：

```bash
spec-first init --codex
spec-first doctor --codex
spec-first clean --codex
```

### 8.3 后续再考虑统一平台参数

如果未来平台数量继续增加，再把参数收敛成：

```bash
spec-first init --platform codex
spec-first doctor --platform codex
spec-first clean --platform codex
```

但这不是第一阶段必须做的事情。

## 9. 风险与对策

### 风险 1：平台逻辑扩散到各命令内部

**对策**：强制通过 adapter 调用，不允许命令层直接写平台路径。

### 风险 2：canonical 资产和运行态资产混淆

**对策**：文档和代码都明确区分：

- canonical source = `templates/`、`skills/`、`agents/`、`.claude-plugin/plugin.json`
- runtime output = 平台适配后的项目本地目录

### 风险 3：Codex 约定和当前猜测不一致

**对策**：Codex 的目标目录、命名空间和可用能力必须集中在 adapter 配置里，不要散落硬编码。

### 风险 4：测试只覆盖 Claude

**对策**：把 adapter 单测和平台 smoke test 分层补齐。

## 10. 测试策略

### 10.1 单元测试

重点覆盖：

- adapter 选择
- 路径拼装
- developer 解析与写入
- state 生成与清理
- 内容转换规则

### 10.2 Smoke 测试

Claude 侧保留现有 smoke。

Codex 侧新增：

- `init --codex` 生成物检查
- `doctor --codex` 通过性检查
- `clean --codex` 清理回收检查

### 10.3 兼容性测试

必须确保：

- `init --claude` 的输出和产物不退化
- `doctor` 在 Claude 模式下继续工作
- 现有 `.developer` 语义保持一致

## 11. 迁移步骤

### 阶段 1：抽 adapter

- 新增平台适配器接口
- 把 Claude 的路径和 transform 迁进去
- 命令层不再直接拼 Claude 路径

### 阶段 2：接入 Codex

- 新增 Codex adapter
- 让 `init --codex` 落盘到 Codex 运行态目录
- 补平台级 smoke test

### 阶段 3：文档和验证

- README 补平台支持说明
- 用户手册补 Codex 初始化流程
- `doctor` 输出增加平台识别信息

### 阶段 4：平台统一化

- 如果后续多个平台共存，再考虑统一成 `--platform`
- 或保留 `--claude / --codex` 双入口以降低用户迁移成本

## 12. 建议结论

推荐的长期方案是：

> **保持 canonical 插件资产不变，在 `spec-first init` 这一层引入平台适配器，把 Claude 运行态和 Codex 运行态分别渲染出来。**

这条路线的好处是：

- 不破坏现有 Claude 用户
- Codex 可以作为第二个平台平滑接入
- 后续扩展到更多平台时，不需要重写仓库资产结构
- `doctor / init / clean / state` 的生命周期治理可以复用

如果要只选一句话概括：

> **Spec-First 应该从“Claude-only 运行态同步器”演进为“统一资产源 + 平台适配器”的多平台工作流框架。**

