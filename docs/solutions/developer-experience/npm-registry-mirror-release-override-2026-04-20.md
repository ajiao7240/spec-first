---
title: npm 镜像源导致 release 发布失败时的环境变量覆盖方案
date: 2026-04-20
category: docs/solutions/developer-experience
module: release
problem_type: developer_experience
component: tooling
severity: high
applies_when:
  - 执行 pnpm run release:publish 时 npm publish 报 ENEEDAUTH 或认证失败
  - 本机 npm config get registry 指向 npmmirror 等镜像源而非 registry.npmjs.org
  - release 脚本内的 npm publish 没有显式指定 --registry 参数
tags: [npm, registry, mirror, release, publish, npmmirror, env-override]
---

# npm 镜像源导致 release 发布失败时的环境变量覆盖方案

## Context

`scripts/release-publish.cjs` 中的 `npm publish` 调用没有显式指定 `--registry`，依赖系统默认 registry。当开发机的默认 registry 被设置为 `https://registry.npmmirror.com` 等国内镜像时，publish 会尝试向镜像源认证，导致 `ENEEDAUTH` 失败——即使 `npm whoami --registry=https://registry.npmjs.org` 通过，也不能保证默认 publish 走 npmjs.org。

## Guidance

**发布时通过环境变量前缀覆盖 registry：**

```bash
npm_config_registry=https://registry.npmjs.org pnpm run release:publish -- auto
```

`npm_config_registry` 是 npm 原生支持的环境变量，会被 `npm publish` 及其子进程全程继承，无需修改全局 npmrc 或发布脚本。

**preflight 必查项：**

```bash
npm config get registry
# 若不是 https://registry.npmjs.org，则后续 publish 必须加环境变量前缀

npm whoami --registry=https://registry.npmjs.org
# 验证 Access Token 已配置
```

## Why This Matters

- 镜像源（npmmirror 等）不接受 npm Access Token 认证，publish 会静默失败或报 `ENEEDAUTH`
- `npm whoami` 通过 ≠ `npm publish` 走正确 registry；两者可以指向不同 registry
- 发布脚本已 bump 版本后才调用 `npm publish`，若 publish 失败需手动收口版本，恢复成本高

## When to Apply

- 任何在国内开发环境发布 npm 包的场景
- 使用 pnpm workspace 或自定义发布脚本且脚本内 `npm publish` 无显式 `--registry` 时
- preflight 检测到 `npm config get registry` 不是 `https://registry.npmjs.org` 时

## Examples

**完整发布命令（带 registry 覆盖）：**

```bash
npm_config_registry=https://registry.npmjs.org pnpm run release:publish -- auto
```

**验证发布成功：**

```bash
npm view spec-first version --registry=https://registry.npmjs.org
```

**根本修复（可选）：在发布脚本中显式指定 registry：**

```js
// scripts/release-publish.cjs 第 122 行
run('npm', ['publish', '--registry=https://registry.npmjs.org']);
```

## Human Summary

### Outcome
通过 `npm_config_registry` 环境变量覆盖镜像源，使 `scripts/release-publish.cjs` 内的 `npm publish` 正确发布到 `registry.npmjs.org`，成功发布 `spec-first@1.5.6`。

### Key Decisions
- 选择环境变量覆盖而非修改全局 npmrc，避免影响其他项目的依赖安装
- 选择环境变量覆盖而非修改发布脚本，最小化侵入；根本修复（脚本内显式 `--registry`）留作 follow-up

### Validation / Result
- `npm_config_registry=https://registry.npmjs.org pnpm run release:publish -- auto` 成功完成
- `npm view spec-first version --registry=https://registry.npmjs.org` 返回 `1.5.6`

### Remaining Risks
- 发布脚本仍未显式指定 `--registry`，下次发布仍需记得加环境变量前缀，或做根本修复

## LLM Reuse Context

### Constraints
- `npm_config_registry` 环境变量只在当前命令的进程树内生效，不持久化到 npmrc
- Access Token 需提前配置：`npm config set //registry.npmjs.org/:_authToken=YOUR_TOKEN`
- 镜像源（npmmirror）的 `npm whoami` 通过不代表 publish 有效；必须用 `--registry=https://registry.npmjs.org` 单独验证

### Code Touchpoints
- `scripts/release-publish.cjs:122` — `run('npm', ['publish'])` 无 `--registry`，是根本问题所在
- `package.json` scripts `release:publish` — pnpm 入口，通过 `npm_config_registry` 前缀时环境变量透传给子进程

### Patterns to Reuse
- 发布前 preflight 固定检查：`npm config get registry` + `npm whoami --registry=https://registry.npmjs.org`
- `npm_config_registry=https://registry.npmjs.org <publish-command>` 作为在镜像源环境中的标准发布前缀

### Anti-patterns to Avoid
- 不要用 `npm whoami`（无 `--registry`）验证认证——它走的是本机默认 registry，可能是镜像源
- 不要在 publish 失败后直接重跑 `auto`——版本已 bump，重跑会继续前滚版本号
- 不要全局修改 npm registry（`npm config set registry`）来绕过问题——会影响所有项目的依赖安装速度

### Provenance
- 本次会话发布 `spec-first@1.5.6` 时实际遭遇，通过 `npm_config_registry` 前缀解决
- 相关背景见 `git-npm` skill 的 Real-world lessons（A 节）

## Related
- `docs/solutions/developer-experience/standalone-skill-name-convention-2026-04-20.md`
- `scripts/release-publish.cjs:122` — 根本修复入口
