# Repository Guidelines

## Project Structure & Module Organization

`spec-first` is a Node.js CLI that installs and manages workflow assets for Claude Code and Codex. Source code lives in `src/cli/`, with the executable entrypoint at `bin/spec-first.js`. Repository-owned workflow content lives in `skills/` and `agents/`; generated runtime copies under `.claude/` or `.codex/` are outputs, not the source of truth. Keep docs in `docs/`, reusable templates in `templates/`, and repo utilities in `scripts/`. `docs/solutions/` contains documented solutions to past problems and workflow patterns, organized by category with YAML frontmatter (`module`, `tags`, `problem_type`); it is relevant when implementing or debugging in documented areas.

Tests are shell-first: `tests/smoke/` covers install and CLI bootstrap flows, `tests/integration/` covers end-to-end scenarios, and `tests/unit/` validates isolated scripts such as language policy and `mcp-setup`.

## Build, Test, and Development Commands

- `npm test` runs the main smoke and integration suite.
- `npm run test:smoke` verifies CLI help, init, generated assets, and doctor output.
- `npm run test:integration` runs the end-to-end workflow checks.
- `bash tests/unit/lang-policy.sh` validates `CLAUDE.md` / `AGENTS.md` governance injection.
- `bash tests/unit/mcp-setup.sh` validates the `mcp-setup` skill scripts and config.
- `npm pack` builds the publishable tarball; use it before release checks.

## Coding Style & Naming Conventions

Use CommonJS in `src/cli/` with 2-space indentation, single quotes, and semicolons. Keep functions small and explicit; mirror the existing command split (`commands/`, adapters, helpers). Shell scripts should start with `#!/bin/bash` and `set -euo pipefail`.

Name skill directories in kebab-case, and use clear commit scopes that match the area touched, for example `feat(mcp-setup): ...` or `fix(spec-bootstrap): ...`.

## Testing Guidelines

Add or update tests with every behavior change. Prefer the narrowest layer that proves the change, then run the broader suite if runtime generation is affected. New shell tests should live in `tests/<layer>/` and keep assertions concrete: verify generated files, CLI output, and exit behavior.

## Commit & Pull Request Guidelines

Follow the repository’s Conventional Commit style: `feat:`, `fix:`, `docs:`, `chore:`, with scopes when useful. PRs should explain which commands, skills, or agents changed, list the verification commands you ran, and note any generated asset impact. Include screenshots only for visual doc or asset changes.

Before changing source code, ensure `CHANGELOG.md` has a matching entry. For new features or significant workflow additions, also update `docs/08-版本更新/README.md`. If `AGENTS.md` or `CLAUDE.md` changes as part of the work, commit it with the related code changes.

<!-- spec-first:lang:start -->
## 语言与治理策略（由 spec-first 管理）

**语言设置：** `zh`

### 语言规则
- 回复、状态更新、生成文档、评审意见、计划说明等所有自然语言输出使用**中文**
- 允许混用英文技术术语，不要求强行翻译常见技术词
- 代码标识符（变量、函数、类、模块、文件名中的技术标识）保持英文
- 新增代码注释使用中文，简洁清晰，不写空洞注释
- 代码、命令、路径、配置键、环境变量名、API 名称、协议名等技术标识不因语言偏好而被翻译

### Changelog 治理规则
**代码变动铁律（无例外）**
- 任何对项目源码的新增、删除、修改，必须同步在项目根目录 `CHANGELOG.md` 中添加一条记录
- 无此记录的代码变动，一律拒绝生成
- 记录格式以仓库现行格式为准
- **示例：** `- vX.Y.Z YYYY-MM-DD 作者: 一句话摘要`
- 用户可见变更在末尾追加 `(user-visible)`
<!-- spec-first:lang:end -->
