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

# 3. Bootstrap Claude project files
spec-first init --claude

# 4. Start Claude in the target project
claude
```

完成初始化后，项目内的 `.claude/commands/spec/` 会成为 `/spec:*` 的真实来源。

## Notes

- npm 发布模型以 `spec-first` CLI 为入口，而不是 Claude plugin marketplace。
- `/spec:*` 命令来自 `spec-first init --claude` 生成的项目级 `.claude/commands/spec/`。

## Testing

```bash
npm test
```

## License

MIT
