---
title: npm 镜像源导致 release 发布失败时的 registry 固定方案
date: 2026-04-20
last_updated: 2026-06-22
category: docs/solutions/developer-experience
module: release
problem_type: developer_experience
component: tooling
severity: high
applies_when:
  - 执行 pnpm run release:publish 时 npm publish 报 ENEEDAUTH 或认证失败
  - 本机 npm config get registry 指向 npmmirror 等镜像源而非 registry.npmjs.org
  - 维护 release 脚本或排查旧版本 release 脚本没有显式指定 --registry 的历史问题
tags: [npm, registry, mirror, release, publish, npmmirror, env-override, explicit-registry]
---

# npm 镜像源导致 release 发布失败时的 registry 固定方案

## Context

历史问题是 `scripts/release-publish.cjs` 中的 `npm publish` 调用没有显式指定 `--registry`，依赖系统默认 registry。当开发机的默认 registry 被设置为 `https://registry.npmmirror.com` 等国内镜像时，publish 会尝试向镜像源认证，导致 `ENEEDAUTH` 失败——即使 `npm whoami --registry=https://registry.npmjs.org` 通过，也不能保证默认 publish 走 npmjs.org。

2026-06-22 刷新时，当前脚本已内置根本修复：

```js
runNpmChecked(['publish', '--registry=https://registry.npmjs.org', '--no-git-checks']);
```

因此，在当前仓库版本里，普通 `pnpm run release:publish -- <version|auto>` 不再依赖本机默认 registry。环境变量覆盖仍是旧版本脚本、一次性手工 `npm publish` 或其他未显式传 `--registry` 发布命令的有效 workaround。

## Guidance

**当前仓库 release 脚本的首选做法：直接使用脚本内置 registry。**

```bash
pnpm run release:publish -- auto
```

脚本会对实际发布调用显式传入 `--registry=https://registry.npmjs.org`，不读取镜像源作为 publish 目标。

**旧脚本或一次性手工发布仍可用环境变量前缀覆盖 registry：**

```bash
npm_config_registry=https://registry.npmjs.org pnpm run release:publish -- auto
```

`npm_config_registry` 是 npm 原生支持的环境变量，会被 `npm publish` 及其子进程全程继承，无需修改全局 npmrc。它适用于没有显式 `--registry` 的旧脚本或临时命令；当前脚本已有更硬的命令参数保护。

**preflight 必查项：**

```bash
npm config get registry
# 若不是 https://registry.npmjs.org，当前脚本仍可发布；旧脚本/手工 publish 必须加环境变量或 --registry

npm whoami --registry=https://registry.npmjs.org
# 验证 Access Token 已配置
```

## Why This Matters

- 镜像源（npmmirror 等）不接受 npm Access Token 认证，publish 会静默失败或报 `ENEEDAUTH`
- `npm whoami` 通过 ≠ `npm publish` 走正确 registry；两者可以指向不同 registry
- 当前脚本已把 registry 固定到 npmjs.org，并在 dry-run 或 publish 未成功时恢复 `package.json` version，避免历史版本 bump 后失败的手工收口风险

## When to Apply

- 任何在国内开发环境发布 npm 包的场景
- 使用 pnpm workspace、旧版 release 脚本或自定义发布脚本且脚本内 `npm publish` 无显式 `--registry` 时
- preflight 检测到 `npm config get registry` 不是 `https://registry.npmjs.org` 时

## Examples

**当前仓库完整发布命令：**

```bash
pnpm run release:publish -- auto
```

**旧脚本/手工命令的 registry 覆盖：**

```bash
npm_config_registry=https://registry.npmjs.org pnpm run release:publish -- auto
```

**验证发布成功：**

```bash
npm view spec-first version --registry=https://registry.npmjs.org
```

**当前根本修复：发布脚本中显式指定 registry。**

```js
runNpmChecked(['publish', '--registry=https://registry.npmjs.org', '--no-git-checks']);
```

## Human Summary

### Outcome
历史会话中通过 `npm_config_registry` 环境变量覆盖镜像源，使旧版 `scripts/release-publish.cjs` 内的 `npm publish` 正确发布到 `registry.npmjs.org`，成功发布 `spec-first@1.5.6`。当前仓库已把该经验固化进 release 脚本：`npm publish` 显式传入 npmjs registry。

### Key Decisions
- 选择环境变量覆盖而非修改全局 npmrc，避免影响其他项目的依赖安装
- 当前脚本已采纳根本修复，环境变量覆盖保留为旧脚本和临时命令的 fallback

### Validation / Result
- 历史验证：`npm_config_registry=https://registry.npmjs.org pnpm run release:publish -- auto` 成功完成
- 当前 source 证据：`scripts/release-publish.cjs` 的 publish 调用包含 `--registry=https://registry.npmjs.org`

### Remaining Risks
- 自定义发布脚本、直接 `npm publish` 或未更新的旧分支仍可能受默认 registry 影响，需要显式 `--registry` 或 `npm_config_registry`

## LLM Reuse Context

### Constraints
- `npm_config_registry` 环境变量只在当前命令的进程树内生效，不持久化到 npmrc
- Access Token 需提前配置：`npm config set //registry.npmjs.org/:_authToken=YOUR_TOKEN`
- 镜像源（npmmirror）的 `npm whoami` 通过不代表 publish 有效；必须用 `--registry=https://registry.npmjs.org` 单独验证

### Code Touchpoints
- `scripts/release-publish.cjs` — 当前 `runNpmChecked(['publish', '--registry=https://registry.npmjs.org', '--no-git-checks'])` 是根本修复
- `package.json` scripts `release:publish` — pnpm 入口；旧脚本或手工命令可通过 `npm_config_registry` 前缀把环境变量透传给子进程

### Patterns to Reuse
- 发布前 preflight 固定检查：`npm config get registry` + `npm whoami --registry=https://registry.npmjs.org`
- release 脚本内显式传 `--registry=https://registry.npmjs.org`
- 对旧脚本或临时命令使用 `npm_config_registry=https://registry.npmjs.org <publish-command>`

### Anti-patterns to Avoid
- 不要用 `npm whoami`（无 `--registry`）验证认证——它走的是本机默认 registry，可能是镜像源
- 不要在 publish 失败后直接重跑 `auto`——版本已 bump，重跑会继续前滚版本号
- 不要全局修改 npm registry（`npm config set registry`）来绕过问题——会影响所有项目的依赖安装速度

### Provenance
- 本次会话发布 `spec-first@1.5.6` 时实际遭遇，通过 `npm_config_registry` 前缀解决
- 相关背景见 `git-npm` skill 的 Real-world lessons（A 节）

## Related
- `scripts/release-publish.cjs` — 当前根本修复入口
