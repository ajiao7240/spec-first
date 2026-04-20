---
title: Standalone Skill 的 name 字段必须使用 spec:* 格式以匹配 Claude 命令规范
date: 2026-04-20
category: docs/solutions/developer-experience
module: skills
problem_type: developer_experience
component: tooling
severity: medium
applies_when:
  - 向 spec-first 添加新的 standalone_skill
  - 重命名已有 skill 的 name 字段
  - 排查 Claude Code 中 skill 命令名称不符合 /spec:* 规范的问题
tags: [skill-naming, standalone-skill, codex-adapter, rewrite-skill-name, spec-command]
---

# Standalone Skill 的 name 字段必须使用 spec:* 格式以匹配 Claude 命令规范

## Context

Claude Code 会自动将 `.claude/skills/` 目录下安装的所有 skill 暴露为斜杠命令，命令名直接取自 SKILL.md 的 `name:` frontmatter 字段。`workflow_command` 类 skill 安装到 `.claude/commands/spec/` 后会自动带上 `spec:` 前缀（如 `/spec:brainstorm`），但 `standalone_skill` 类 skill 直接用 `name:` 字段，不会自动加前缀。

历史原因导致四个 standalone skill 的命名不一致：

| Skill 目录 | 原 name | Claude 中显示 |
|-----------|---------|--------------|
| `spec-optimize` | `spec-optimize` | `/spec-optimize` |
| `spec-work-beta` | `work-beta-workflow` | `/work-beta-workflow` |
| `spec-slack-research` | `spec-slack-research` | `/spec-slack-research` |
| `spec-compound-refresh` | `compound-refresh-workflow` | `/compound-refresh-workflow` |

## Guidance

**standalone_skill 的 `name:` 字段统一使用 `spec:<name>` 冒号格式**，与 workflow_command 的 `/spec:*` 规范保持一致。

```yaml
# ✅ 正确
name: spec:optimize

# ❌ 错误
name: spec-optimize
name: optimize
name: work-beta-workflow
```

Codex adapter（`src/cli/adapters/codex.js`）在安装时通过 `rewriteSkillName` 函数（第 195-201 行）用**目录名**覆盖 `name:` 字段，所以 Codex 侧不受影响——目录名 `spec-optimize` 对应 `$spec-optimize`。

## Why This Matters

- 命名不一致导致 Claude Code 命令列表中出现不符合规范的入口（`/spec-optimize`、`/work-beta-workflow`），用户无法预测命名规律
- `workflow_command` 和 `standalone_skill` 应对外呈现统一的 `/spec:*` 命名空间

## When to Apply

- 新增任何 `standalone_skill`（`entry_surface: standalone_skill`）时
- 所有对外暴露的 standalone skill 均需 `name: spec:<name>` 格式
- 不对外暴露的 skill（已设 `disable-model-invocation: true`）同样应遵循此规范，保持命名一致性

## Examples

**修复前后对比**（`skills/spec-optimize/SKILL.md`）：

```yaml
# 修复前
name: spec-optimize

# 修复后
name: spec:optimize
```

**修复后各平台表现**：

| 平台 | 命令 | 来源 |
|------|------|------|
| Claude | `/spec:optimize` | SKILL.md `name:` 字段直接使用 |
| Codex | `$spec-optimize` | `rewriteSkillName` 用目录名 `spec-optimize` 覆盖 |

## Human Summary

### Outcome
将四个 standalone skill 的 `name:` 字段统一改为 `spec:*` 冒号格式，Claude Code 中的斜杠命令从 `/spec-optimize` 等非标准形式变为 `/spec:optimize` 等规范形式。

### Key Decisions
- 利用 Codex adapter 的 `rewriteSkillName` 机制：源文件写 `spec:optimize`，Codex 安装时自动回写为目录名 `spec-optimize`，双平台命名各自符合规范，无需额外维护两套名称
- `spec-work-beta` 和 `spec-compound-refresh` 虽不对外主动暴露（已有 `disable-model-invocation: true`），同样改为 `spec:*` 格式保持一致性

### Validation / Result
- `skills/spec-optimize/SKILL.md`：`name: spec:optimize`
- `skills/spec-slack-research/SKILL.md`：`name: spec:slack-research`（Usage 示例同步更新）
- `skills/spec-work-beta/SKILL.md`：`name: spec:work-beta`
- `skills/spec-compound-refresh/SKILL.md`：`name: spec:compound-refresh`
- 重新运行 `spec-first init --claude` 后生效

### Remaining Risks
- 此规范未被 `skills-governance.json` 的校验逻辑强制检查，新增 skill 时仍需人工遵守

## LLM Reuse Context

### Constraints
- `name:` 字段对 Codex 无影响，Codex 安装时始终被目录名覆盖（`rewriteSkillName`）
- 对外暴露的 standalone skill 的 `name:` 必须为 `spec:<kebab-name>` 格式
- 不要在 `name:` 里用下划线或大写；只用小写 kebab + `spec:` 前缀

### Code Touchpoints
- `src/cli/adapters/codex.js:195-201` — `rewriteSkillName` 在 Codex 安装时覆盖 `name:` 字段
- `src/cli/adapters/claude.js:52-54` — Claude adapter 不重写 `name:` 字段，直接保留源文件内容
- `skills/<skill-name>/SKILL.md` — 各 skill 的 frontmatter `name:` 字段

### Patterns to Reuse
- 新增 standalone skill 时，直接在 SKILL.md frontmatter 写 `name: spec:<dir-name>`（去掉目录名中的 `spec-` 前缀后补 `spec:` 前缀，如目录 `spec-foo` → `name: spec:foo`）

### Anti-patterns to Avoid
- 不要用描述性词汇作为 `name:`（如 `work-beta-workflow`、`compound-refresh-workflow`），这会导致命令名与 spec-first 命名空间脱节
- 不要省略 `spec:` 前缀（如 `name: optimize`），会导致显示为 `/optimize` 而非 `/spec:optimize`

### Provenance
- 会话分析：用户发现 Claude Code 命令列表中出现不符合规范的命令名
- 修复 commit：CHANGELOG.md `v1.5.5 2026-04-20` 条目
- 关键机制发现：阅读 `src/cli/adapters/codex.js` `rewriteSkillName` 函数

## Related
- `src/cli/contracts/dual-host-governance/skills-governance.json` — skill 治理注册表，目前未校验 `name:` 格式
