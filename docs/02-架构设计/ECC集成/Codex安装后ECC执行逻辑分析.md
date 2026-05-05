# Codex 安装后 ECC 执行逻辑分析

## 0. 结论摘要

结论先行：ECC 在 Codex 里的核心不是启动一个后台 runtime，而是把一组可被 Codex 加载的静态资产放到正确位置：

```text
AGENTS.md        管治理、默认行为和使用策略
.agents/skills   管可触发的具体工作流能力
.codex/config    管 Codex 运行配置、MCP、profile、多 agent 角色
.codex/agents    管 Codex 多 agent role 配置
commands/        在 Codex 中降级为 prompt/reference，不是 Claude Code 式 slash command
.codex-plugin    面向 Codex 插件/市场机制的 manifest，不等同于当前 CLI 的全部安装路径
```

用户安装后在 Codex 中主要有两种使用方式：

1. **自然语言 + `$skill-name` 显式调用**，例如 `使用 $tdd-workflow 修复这个 bug`。
2. **依赖 `AGENTS.md` 的隐式治理**，让 Codex 按项目规则自动选择 TDD、安全审查、验证、MCP 查询或多 agent review。

因此，`AGENTS.md` 是管理中枢，但不是唯一执行面。它负责“何时用、用什么规则、不要做什么”；真正执行某类工作流的是 skill、MCP tool 和 Codex agent role。

准确性校验日期：2026-05-05。

本次校验基于当前仓库和本机 Codex CLI：

- 当前仓库版本：`2.0.0-rc.1`
- `agents/*.md`：48 个
- `commands/*.md`：68 个
- `skills/*/SKILL.md`：182 个共享 skills
- `.agents/skills/*/SKILL.md`：57 个 Codex-facing skills
- 本机 `codex-cli`：`0.128.0`
- 当前 `codex plugin` 帮助中只暴露 `marketplace` 子命令，未暴露 README 中提到的 `codex plugin install` 子命令

---

## 1. 安装入口全景

ECC 当前同时提供三类 Codex 相关入口。

| 入口 | 主要文件 | 作用 | 适用场景 |
|---|---|---|---|
| npm CLI | `package.json`、`scripts/ecc.js`、`scripts/install-apply.js` | 通过 `npx ecc ...` 或 `npx ecc-install ...` 执行 manifest 安装 | 跨 harness 的通用安装与诊断 |
| Codex 同步脚本 | `scripts/sync-ecc-to-codex.sh` | 把 ECC Codex 资产合并到 `~/.codex`，保护用户已有配置 | 当前最适合 Codex CLI 的全局同步路径 |
| Codex plugin manifest | `.codex-plugin/plugin.json` | 声明插件名、skills 路径和 MCP 路径 | 面向 Codex 插件/市场机制；当前 CLI 支持仍需按实际版本确认 |

### 1.1 npm 包暴露面

`package.json` 中将 `.agents/`、`.codex/`、`.codex-plugin/`、`skills/`、`agents/`、`commands/`、`mcp-configs/` 等都列入发布文件，并暴露：

```json
"bin": {
  "ecc": "scripts/ecc.js",
  "ecc-install": "scripts/install-apply.js"
}
```

这意味着：

- `npx ecc ...` 是总入口。
- `npx ecc-install ...` 是兼容旧流程的直接安装入口。
- `ecc` 本身不会加载 Codex，它只负责把资产安装或同步到目标目录。

### 1.2 `ecc` 命令分发逻辑

`scripts/ecc.js` 的命令分发表如下：

```text
install
plan
catalog
consult
list-installed
doctor
repair
auto-update
status
sessions
session-inspect
loop-status
uninstall
```

如果用户执行：

```bash
npx ecc install --profile minimal --target codex
```

调用链是：

```text
scripts/ecc.js
  -> scripts/install-apply.js
    -> scripts/lib/install/request.js
    -> scripts/lib/install/runtime.js
    -> scripts/lib/install-executor.js
    -> scripts/lib/install-targets/codex-home.js
```

如果用户执行旧式语言参数，例如：

```bash
npx ecc typescript
```

`ecc` 会识别为 legacy language install，并隐式转到 `install`。但这个路径默认 target 是 `claude`，不是 `codex`。

---

## 2. Codex target 的 manifest 安装逻辑

Codex target adapter 定义非常短：

```js
module.exports = createInstallTargetAdapter({
  id: 'codex-home',
  target: 'codex',
  kind: 'home',
  rootSegments: ['.codex'],
  installStatePathSegments: ['ecc-install-state.json'],
  nativeRootRelativePath: '.codex',
});
```

含义是：

- 目标根目录是 `~/.codex`
- 安装状态写到 `~/.codex/ecc-install-state.json`
- 仓库内 `.codex/` 是 native root，会同步到 `~/.codex/` 根下
- 非 Codex 平台目录会被过滤，例如 `.claude-plugin`、`.cursor` 等不会作为 Codex 平台资产安装

### 2.1 manifest 选择

安装请求由 `normalizeInstallRequest()` 归一化：

```text
有 --profile / --modules / --with / --without -> manifest 模式
只有语言参数 -> legacy-compat 模式
默认 target -> claude
```

所以 Codex 安装必须显式带 target：

```bash
npx ecc install --profile minimal --target codex
```

或：

```bash
npx ecc-install --profile minimal --target codex
```

### 2.2 profile 在 Codex target 下的实际筛选

以 `minimal` 为例，profile 请求模块包含：

```text
rules-core
agents-core
commands-core
platform-configs
workflow-quality
```

但 Codex target 实际只会选择支持 Codex 的模块：

```text
agents-core
platform-configs
workflow-quality
```

`rules-core` 和 `commands-core` 会被跳过，因为它们的 target 清单不包含 `codex`。

### 2.3 文件落地模型

安装器先创建 scaffold operation，再 materialize 成具体文件复制操作。

例如 `agents-core` 会把：

```text
.agents/skills/... -> ~/.codex/.agents/skills/...
agents/...         -> ~/.codex/agents/...
AGENTS.md          -> ~/.codex/AGENTS.md
```

`platform-configs` 会把：

```text
.codex/...         -> ~/.codex/...
mcp-configs/...    -> ~/.codex/mcp-configs/...
```

`workflow-quality` 会把部分共享 skills 复制到：

```text
skills/...         -> ~/.codex/skills/...
```

### 2.4 当前实现中的覆盖风险

通用 manifest 安装里有一个需要注意的点：

```text
agents-core:      AGENTS.md        -> ~/.codex/AGENTS.md
platform-configs: .codex/AGENTS.md -> ~/.codex/AGENTS.md
```

这两个 operation 的目标路径相同，后执行的 `.codex/AGENTS.md` 会覆盖根 `AGENTS.md`。

因此，面向真实用户的 Codex 全局配置，更推荐使用 `scripts/sync-ecc-to-codex.sh`，因为它会 marker-based 合并根 `AGENTS.md` 和 `.codex/AGENTS.md`，而不是简单覆盖。

---

## 3. 推荐的 Codex 全局同步路径

当前最稳的 Codex CLI 路径是：

```bash
cd /Users/kuang/xiaobu/everything-claude-code
npm install
bash scripts/sync-ecc-to-codex.sh --dry-run
bash scripts/sync-ecc-to-codex.sh
```

同步脚本执行以下动作：

1. 检查必须文件是否存在：
   - 根 `AGENTS.md`
   - `.codex/AGENTS.md`
   - `.codex/agents`
   - `commands`
   - Codex config merge script
   - MCP merge script
2. 备份：
   - `~/.codex/config.toml`
   - `~/.codex/AGENTS.md`
3. 合并 ECC instructions：
   - `AGENTS.md`
   - `.codex/AGENTS.md`
   - 使用 `<!-- BEGIN ECC -->` / `<!-- END ECC -->` marker 保护用户内容
4. add-only 合并 Codex baseline：
   - `approval_policy`
   - `sandbox_mode`
   - `web_search`
   - `persistent_instructions`
   - profiles
   - agents role 配置
5. 同步 sample Codex agent role：
   - `explorer.toml`
   - `reviewer.toml`
   - `docs-researcher.toml`
6. 从 `commands/*.md` 生成 `~/.codex/prompts/ecc-*.md`
7. 生成额外 prompt：
   - `ecc-tool-run-tests.md`
   - `ecc-tool-check-coverage.md`
   - `ecc-tool-security-audit.md`
   - `ecc-rules-pack-common.md`
   - `ecc-rules-pack-typescript.md`
   - `ecc-rules-pack-python.md`
   - `ecc-rules-pack-golang.md`
   - `ecc-rules-pack-swift.md`
8. 合并 MCP servers：
   - Supabase
   - Playwright
   - Context7
   - Exa
   - GitHub
   - Memory
   - Sequential Thinking
9. 安装全局 git safety hooks
10. 运行 Codex 全局状态 sanity check

### 3.1 同步脚本不复制 skills

脚本中明确写着：

```text
Skills are NOT synced here — Codex CLI reads directly from
~/.agents/skills/ (installed by ECC installer / npx skills).
Copying into ~/.codex/skills/ was unnecessary.
```

这和 README 中“sync ECC assets (AGENTS.md, skills, MCP servers)”的描述存在轻微漂移。以当前源码为准：`sync-ecc-to-codex.sh` 负责 instructions、config、MCP、prompts、agent role，不负责复制 skills。

如果用户希望 Codex 直接拿到本仓库的 Codex-facing skills，有三种方式：

| 方式 | 说明 |
|---|---|
| 在本仓库运行 `codex` | Codex 读取项目本地 `.agents/skills` |
| 使用 Codex plugin/marketplace 机制 | 由 `.codex-plugin/plugin.json` 的 `skills` 字段指向 `./skills/` |
| 使用通用 installer target codex | 将 `.agents` 或 selected `skills` 复制到 `~/.codex`，但需注意 `AGENTS.md` 覆盖问题 |

---

## 4. Codex 内用户如何使用

### 4.1 显式调用 skill

最推荐、最可控的用法是直接在 Codex 中提到 `$skill-name`：

```text
使用 $tdd-workflow 修复这个 bug，先写失败测试，再实现修复。
```

```text
使用 $security-review 审查当前 git diff，按 CRITICAL/HIGH/MEDIUM/LOW 输出问题。
```

```text
使用 $verification-loop 运行 lint、test、typecheck，并修复失败项。
```

```text
使用 $documentation-lookup 查最新官方文档后再改这个 Next.js API。
```

`agents/openai.yaml` 里的 `default_prompt` 会帮助 Codex 把技能作为工具化工作流呈现。例如 `tdd-workflow` 的 metadata：

```yaml
interface:
  display_name: "TDD Workflow"
  short_description: "Test-driven development with coverage gates"
  default_prompt: "Use $tdd-workflow to drive the change with tests before implementation."
policy:
  allow_implicit_invocation: true
```

### 4.2 依赖隐式触发

如果 `AGENTS.md` 和 skills 都被 Codex 加载，用户也可以直接描述任务：

```text
修复这个登录失败问题，并补测试。
```

此时 `AGENTS.md` 会要求：

- bug fix 或新功能优先 TDD
- 敏感代码走 security review
- 修改后做 verification
- 不要硬编码 secrets
- 不要随意重构无关代码

但隐式触发依赖模型判断。对于重要工作，显式写 `$tdd-workflow`、`$security-review`、`$verification-loop` 更稳定。

### 4.3 使用 MCP

Codex config 中 MCP 可让用户这样要求：

```text
用 Context7 查 React 当前官方文档，再解释这个 API 怎么用。
```

```text
用 Playwright 打开 http://localhost:3000 验证登录流程。
```

```text
用 Exa 搜索这个库的最新发布说明，并总结破坏性变更。
```

```text
把这次调试结论写入 Memory，后续同项目复用。
```

### 4.4 使用 Codex profile

`.codex/config.toml` 提供两个 profile：

```bash
codex -p strict -C /path/to/project
codex -p yolo -C /path/to/project
```

含义：

| Profile | 行为 |
|---|---|
| `strict` | `read-only` sandbox，适合审查和只读分析 |
| `yolo` | `workspace-write` + `approval_policy = never`，适合明确授权的自动执行 |

### 4.5 使用 Codex 多 agent

`.codex/config.toml` 注册了：

```text
explorer
reviewer
docs_researcher
```

用户可以在 Codex CLI 中使用 `/agent` 查看和调度。典型说法：

```text
先让 explorer 只读分析调用链，我继续看测试。
```

```text
完成修改后让 reviewer 做 correctness/security review。
```

```text
这个 API 行为不确定，让 docs_researcher 查官方文档。
```

---

## 5. `AGENTS.md` 的职责边界

`AGENTS.md` 是 Codex 使用 ECC 的治理中枢，主要负责：

| 职责 | 例子 |
|---|---|
| 工作流治理 | 复杂功能先 plan，bug/new feature 走 TDD，修改后 review/verification |
| 安全基线 | 不硬编码 secrets，验证输入，避免 SQL injection/XSS/CSRF |
| 代码风格 | 不随意改无关代码，保持小文件、小函数、不可变数据 |
| 语言策略 | 当前项目默认中文输出 |
| spec-first 入口治理 | 修改 docs/config/source 前判断是否进入 `$spec-*` |
| 用户配置保护 | 不覆盖用户无关改动，不擅自改第三方资源 |

但 `AGENTS.md` 不负责：

| 非职责 | 实际由谁负责 |
|---|---|
| 提供具体 TDD 步骤 | `$tdd-workflow` skill |
| 提供安全审查 checklist | `$security-review` skill |
| 提供工具连接 | `config.toml` 的 MCP servers |
| 定义 agent role 文件 | `.codex/agents/*.toml` |
| 生成 prompt 文件 | `scripts/sync-ecc-to-codex.sh` |
| 插件目录呈现 | `.codex-plugin/plugin.json` |

一句话：

```text
AGENTS.md 决定 Codex 应该如何工作；
skills 决定某类工作具体怎么做；
config.toml 决定 Codex 有哪些工具和权限；
.codex/agents 决定可调度的角色；
.codex-plugin 决定插件市场如何识别 ECC。
```

---

## 6. `.codex-plugin` 的作用和当前限制

`.codex-plugin/plugin.json` 当前声明：

```json
{
  "name": "ecc",
  "version": "2.0.0-rc.1",
  "skills": "./skills/",
  "mcpServers": "./.mcp.json"
}
```

测试也明确约束：

- `.codex-plugin/plugin.json` 必须存在
- `skills` 必须是字符串路径，不是数组
- `mcpServers` 必须是字符串路径
- `.mcp.json` 必须在插件根目录，不在 `.codex-plugin/` 目录内

这说明 `.codex-plugin` 是 Codex plugin manifest，而不是普通 installer 的配置文件。

当前本机 `codex-cli 0.128.0` 的 `codex plugin --help` 只显示：

```text
codex plugin marketplace
```

没有直接显示 `codex plugin install`。因此对当前 CLI 用户，推荐优先使用：

```bash
bash scripts/sync-ecc-to-codex.sh
```

或通用安装器：

```bash
npx ecc install --profile minimal --target codex
```

当 Codex plugin install/marketplace 机制稳定后，`.codex-plugin/plugin.json` 才是更自然的插件安装入口。

---

## 7. Codex 与 Claude Code 的关键差异

| 能力 | Claude Code | Codex |
|---|---|---|
| 主上下文文件 | `CLAUDE.md` + `AGENTS.md` | `AGENTS.md` |
| Slash commands | 原生命令面 | 当前以 prompt/reference 为主 |
| Skills | 插件或 skills 目录加载 | `.agents/skills` / 插件 skills 加载 |
| Hooks | Claude Code hook runtime | 当前不具备完全对等的 Claude-style hooks |
| Agents | Claude Code subagent Task tool | Codex multi-agent role + `/agent` |
| MCP | 插件/配置支持 | `config.toml` / `codex mcp` |
| 安全约束 | hooks + instructions | instructions + sandbox + approval |

这也是为什么 Codex 里 `AGENTS.md` 更重要：缺少 Claude Code hook parity 时，很多强制策略只能靠 instructions、sandbox、approval 和 review workflow 兜底。

---

## 8. 用户安装后的推荐操作手册

### 8.1 只在 ECC 仓库内体验

```bash
cd /Users/kuang/xiaobu/everything-claude-code
codex
```

然后在 Codex 中输入：

```text
使用 $tdd-workflow 解释这个仓库的安装测试结构。
```

### 8.2 全局启用 ECC Codex 配置

```bash
cd /Users/kuang/xiaobu/everything-claude-code
npm install
bash scripts/sync-ecc-to-codex.sh --dry-run
bash scripts/sync-ecc-to-codex.sh
```

然后重启 Codex：

```bash
codex -C /path/to/your/project
```

### 8.3 只做 manifest 安装预览

```bash
npx ecc plan --profile minimal --target codex --json
npx ecc install --profile minimal --target codex --dry-run
```

### 8.4 常用自然语言入口

```text
使用 $tdd-workflow 实现这个需求。
```

```text
使用 $security-review 审查这次变更。
```

```text
使用 $verification-loop 完成提交前验证。
```

```text
使用 $documentation-lookup 查官方文档后再回答。
```

```text
用 reviewer agent 审查当前 diff。
```

```text
用 Playwright MCP 打开本地页面并验证核心流程。
```

---

## 9. 风险与改进建议

### 9.1 文档与实现存在轻微漂移

README 中 Codex Quick Start 写“sync ECC assets (AGENTS.md, skills, MCP servers)”，但脚本明确不同步 skills。

建议后续将 README 改为：

```text
sync ECC Codex assets (AGENTS.md, config, prompts, MCP servers, and sample agent roles)
```

并单独说明 skills 来源：

```text
Skills are loaded from project-local .agents/skills, ~/.agents/skills, or Codex plugin skills depending on installation mode.
```

### 9.2 `--target codex` manifest 安装会覆盖 `AGENTS.md`

当前 plan 中根 `AGENTS.md` 和 `.codex/AGENTS.md` 目标路径相同。建议后续改造 Codex adapter：

- 对 `AGENTS.md` 做 marker merge，而不是普通 copy
- 或将 `.codex/AGENTS.md` 安装为 `~/.codex/AGENTS.ecc-codex.md`，再由 config 或合并脚本引用
- 或明确将 `sync-ecc-to-codex.sh` 作为 Codex 全局推荐路径，manifest target 只作为 scaffold/preview

### 9.3 Codex plugin 文档需要跟随 CLI 能力

当前本机 CLI 没有 `codex plugin install`，只有 marketplace 管理入口。建议 README 对 Codex plugin 安装描述增加版本条件：

```text
If your Codex CLI exposes plugin install, use ...
Otherwise use sync-ecc-to-codex.sh or marketplace flow supported by your CLI version.
```

### 9.4 明确 commands 在 Codex 中不是 slash command parity

Codex 同步脚本会生成 `~/.codex/prompts/ecc-*.md`，但这不是 Claude Code 的 `/command` 同等体验。

建议文档中统一称为：

```text
legacy command prompts
```

而不是暗示 Codex 原生支持 ECC slash commands。

---

## 10. 最终判断

Codex 安装后的 ECC 使用管理可以概括为：

```text
AGENTS.md 是治理中枢
$skill-name 是主要用户调用入口
config.toml 是工具和权限平面
.codex/agents 是多 agent 角色平面
sync-ecc-to-codex.sh 是当前 Codex CLI 最稳的全局同步路径
.codex-plugin 是面向插件/市场机制的声明入口
```

所以，用户问“主要是 agent.md 来管理使用的吗”，精确回答是：

```text
是，主要由 AGENTS.md 管理使用策略；
但实际执行依赖 skills、MCP、config profile 和 agent role。
AGENTS.md 管规则，skills 管动作，config 管工具，agents 管角色。
```
