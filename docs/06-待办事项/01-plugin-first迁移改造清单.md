# Spec-First Plugin-First 迁移改造清单

## 目标

在不打断当前 npm CLI 使用链路的前提下，把 `spec-first` 从当前混合模型逐步迁移到更适合多平台接入的 `plugin-first` 模型。

当前原则：

- 短期保留 `/spec:*` 作为稳定用户入口
- 当前发布资产已经包含 `skills/` 和 `agents/`
- 中期补齐 `.claude-plugin/plugin.json` 和统一插件元数据
- 长期以插件资产为单一事实来源，再决定是否弱化或移除 `templates/`

## 当前状态

### 已完成

- [x] 保留 `templates/claude/commands/spec/` 作为 `/spec:*` 的稳定入口
- [x] 修复 workflow skill 与 `/spec:*` 命令重复暴露的问题
- [x] `npm pack` 已包含 `skills/`
- [x] `npm pack` 已包含 `agents/`
- [x] `npm pack` 已包含 `.claude-plugin/plugin.json`
- [x] `spec-first init --claude` 已同步：
  - [x] `.claude/commands/spec/`
  - [x] `.claude/skills/`
  - [x] `.claude/agents/`
- [x] `spec-first doctor` 已校验：
  - [x] `.claude-plugin/plugin.json`
  - [x] `.claude/commands/spec`
  - [x] `.claude/skills`
  - [x] `.claude/agents`
- [x] smoke test 已覆盖 commands / skills / agents 打包与初始化
- [x] `/spec:*` command templates 已显式委托到对应 workflow skill

### 当前模型

- 用户入口：`/spec:*`
- 工作流层：`skills/`
- 子代理层：`agents/`
- 安装方式：`npm install -g spec-first` + `spec-first init --claude`

## 迁移原则

1. 不为了追求结构统一而打断当前用户入口。
2. 先统一发布资产模型，再统一平台适配模型。
3. `skill` 负责流程编排，`agent` 负责子任务执行。
4. 只有当 plugin manifest 与同步逻辑成熟后，才考虑让 `templates/` 退出主路径。

## 阶段一：插件元数据补齐

目标：让仓库具备插件清单能力，但不改变当前 CLI 使用方式。

- [x] 创建 `.claude-plugin/plugin.json`
- [x] 在 manifest 中明确声明：
  - [x] 插件名称、版本、描述、仓库地址
  - [x] `skills/` 目录
  - [x] `agents/` 目录
  - [x] 未来可扩展的 `hooks` / `mcpServers`
- [ ] 评估是否补 `README` / `AGENTS.md` 作为插件说明层
- [x] 增加 manifest 基础校验测试
- [x] 文档中明确“当前仍以 CLI 初始化为主，manifest 只是统一资产描述”

交付标准：

- 仓库存在可读的插件元数据
- 元数据不影响现有 `npm install -g` 与 `init --claude`

## 阶段二：统一资产发现与同步

目标：把当前分散在 `templates.js`、`skills.js`、`agents.js` 的同步逻辑，收敛为统一的插件资产同步层。

- [x] 新增统一插件加载模块
- [x] 统一读取：
  - [x] commands
  - [x] skills
  - [x] agents
  - [ ] 未来的 hooks / mcp
- [x] 让 `init --claude` 从统一插件清单同步，而不是分别硬编码同步 commands / skills / agents
- [x] 让 `doctor` 从统一插件清单进行完整性校验
- [ ] 为同步层补单元测试
- [x] 为 manifest -> runtime 同步链路补集成测试

交付标准：

- 当前 CLI 不再依赖多份分散的目录扫描逻辑
- 插件资产的“源头”从目录约定收敛为 manifest + 统一加载器

## 阶段三：多平台适配准备

目标：让 `spec-first` 的资产模型可被不同平台消费，而不是只服务 Claude Code。

- [ ] 抽象目标平台输出模型
- [ ] 明确第一批支持目标：
  - [ ] Claude Code
  - [ ] Codex
  - [ ] Cursor
  - [ ] Gemini / Kiro / 其他目标平台（按优先级分批）
- [ ] 设计平台差异映射：
  - [ ] commands 如何落地
  - [ ] skills 如何落地
  - [ ] agents 如何落地
  - [ ] hooks / mcp 如何落地
- [ ] 增加平台转换 smoke tests
- [ ] 评估是否需要拆出 `convert` / `install` 子命令

交付标准：

- 至少有一套“插件资产 -> 目标平台目录结构”的稳定转换接口
- 当前 Claude 模型不受影响

## 阶段四：入口模型收敛

目标：评估是否还需要长期保留 `templates/` 作为主入口层。

- [ ] 盘点 `templates/` 与 `skills/` 的能力重叠
- [ ] 明确是否继续保留 `/spec:*` 命令模板作为长期兼容层
- [ ] 如果切换到 plugin-first 入口：
  - [ ] 先提供迁移说明
  - [ ] 先保留兼容窗口
  - [ ] 再移除旧模板依赖
- [ ] 如果继续保留混合入口：
  - [ ] 文档明确“commands 是用户入口，skills/agents 是执行资产”
  - [ ] 禁止 workflow skills 再次暴露为重复 slash commands

交付标准：

- 入口模型清晰且单一，不再出现重复命令
- 用户文档、测试、发布逻辑完全一致

## 风险清单

- [ ] 风险：过早删除 `templates/` 打断当前 `init --claude`
- [ ] 风险：引入 plugin manifest 但没有统一加载器，导致维护两套事实来源
- [ ] 风险：多平台转换过早启动，导致 Claude 主链路不稳定
- [ ] 风险：`skills/` 与 `agents/` 命名暴露不受控，重新出现重复入口

## 决策记录

- 当前推荐路线：**先稳定混合模型，再渐进迁移到 plugin-first**
- 当前不建议做的事：**直接删除 `templates/`**
- 当前长期方向：**为了多平台接入，最终应以插件资产模型为主**

## 下一步

建议按顺序执行：

1. 评估是否补 `AGENTS.md` 作为插件说明层
2. 为统一插件加载层补更细粒度单元测试
3. 再启动多平台适配设计
