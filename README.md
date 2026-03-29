# Spec-First Framework

AI-assisted work framework for Claude Code with five-step loop.

## Installation

### From npm (Recommended, aligned with the published `spec-first` CLI)

```bash
npm install -g spec-first
spec-first doctor
spec-first init --claude
```

### From Source

```bash
git clone https://github.com/sunrain520/spec-first.git
cd spec-first
npm pack
npm install -g ./spec-first-<version>.tgz
```

源码下载后，实际安装流程是先 `npm pack`，再用生成的 tarball 做全局安装。
如果当前 shell 里还缓存着旧的 `spec-first` 路径，先执行 `hash -r`，或者重开一个终端。

See [Installation Guide](./docs/05-用户手册/06-本地源码安装.md) for details.

## Quick Start

```bash
# 1. Install CLI
npm install -g spec-first

# 2. Verify host integration
spec-first doctor

# 3. Bootstrap Claude project files, bundled skills, and bundled agents
spec-first init --claude

# 4. Start Claude in the target project
claude
```

完成初始化后，项目内的 `.claude/commands/spec/` 会成为 `/spec:*` 的真实来源，`.claude/skills/` 和 `.claude/agents/` 会同步发布包内的执行资产。
命令模板会先委托给对应的 workflow skill，再按 skill 合同决定产物路径和阶段交接。

## Notes

- npm 发布模型以 `spec-first` CLI 为入口，而不是 Claude plugin marketplace。
- `/spec:*` 命令来自 `spec-first init --claude` 生成的项目级 `.claude/commands/spec/`。
- `.claude/commands/spec/*.md` 只负责稳定入口；每个命令都会明确以对应 `.claude/skills/spec-*/SKILL.md` 为执行合同。
- `spec-first init --claude` 还会把 `skills/` 同步到项目级 `.claude/skills/`，让发布后的 skill 引用继续可用。
- `spec-first init --claude` 也会把 `agents/` 同步到项目级 `.claude/agents/`，供 skills 调度内部子代理。
- 发布包内现在还包含 `.claude-plugin/plugin.json`，作为 commands / skills / agents 的统一资产清单。
- 这批 bundled workflow skills 是内部协作层，不再作为独立 slash commands 暴露；用户入口仍以 `/spec:*` 命令为准。

## Testing

```bash
npm test
```

## License

MIT
