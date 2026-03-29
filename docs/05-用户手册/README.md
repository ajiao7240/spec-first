# Spec-First 用户手册

欢迎使用 Spec-First Framework！

当前手册对应 `spec-first` 的 npm CLI 模型：

- `npm install -g spec-first`
- `spec-first doctor`
- `spec-first init --claude`
- `/spec:*` 命令来自项目内 `.claude/commands/spec/`
- 每个 `/spec:*` 命令都会显式委托给对应 `.claude/skills/spec-*/SKILL.md`
- `spec-first init --claude` 还会同步发布包内的 `skills/` 到 `.claude/skills/`
- `spec-first init --claude` 还会同步发布包内的 `agents/` 到 `.claude/agents/`
- 发布包内还包含 `.claude-plugin/plugin.json` 作为统一资产清单
- bundled workflow skills 只作为内部协作层存在，用户仍然通过 `/spec:*` 命令使用 Spec-First

## 目录

1. [快速开始](./01-快速开始.md)
   - 安装方法
   - 第一个任务
   - 基本使用

2. [核心概念](./02-核心概念.md)
   - 五步闭环
   - 阶段说明
   - 判定规则

3. [完整示例](./03-完整示例.md)
   - 用户登录功能
   - 完整流程演示

4. [常见问题](./04-常见问题.md)
   - 安装问题
   - 使用问题
   - 高级问题

5. [最佳实践](./05-最佳实践.md)
   - 各阶段推荐做法
   - 常见错误

6. [本地源码安装](./06-本地源码安装.md)
   - 从源码安装
   - 开发模式
   - 故障排查

## 快速链接

- [GitHub 仓库](https://github.com/sunrain520/spec-first)
- [问题反馈](https://github.com/sunrain520/spec-first/issues)

## 版本

当前版本：v1.3.10
