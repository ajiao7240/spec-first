---
title: Codex CLI 已支持完整 lifecycle hooks，dual-host hook parity 重新成立
date: 2026-05-26
category: docs/solutions/tooling-decisions
module: dual-host-governance
problem_type: tooling_decision
component: tooling
severity: medium
applies_when:
  - 设计 spec-first dual-host hook 注入或会话生命周期治理
  - 判断"核心治理只能放 helper、不能放 hook"的理由是否仍成立
  - 评估 spec-first 是否要往 Codex 端发布 plugin / 写 hook 模板
  - 任何文档或回答里仍声称 "Codex 无 hook"、"Codex 不支持 PreToolUse" 等等
  - 设计跨宿主的 mutation gating、压缩后上下文恢复或 reviewer dispatch 前的注入
tags: [codex-cli, claude-code, lifecycle-hooks, dual-host-governance, hook-parity, plugin-distribution]
---

# Codex CLI 已支持完整 lifecycle hooks，dual-host hook parity 重新成立

## Context

spec-first 项目长期假设 Codex CLI 没有与 Claude Code 对等的 hook 系统。这个假设直接影响 dual-host 设计：

- `templates/claude/hooks/session-start` 存在并由 `spec-first init --claude` 写入 `.claude/hooks/`。
- `templates/codex/` 不存在，Codex 端只能靠 `AGENTS.md` 的 managed block 在 session 启动时被自动读取。
- 由此推导出"核心治理必须放 helper command 而不是 hook"的设计原则——理由是 hook 在 Codex 端不存在，依赖 hook 会让两个宿主行为分裂。

2026-05-26 校核 `openai/codex` 仓库源码后发现这个假设已经过时：Codex 现行版本（feature flag `CodexHooks` 已标记为 **Stable**，源码注释直接写 "Claude-style lifecycle hooks loaded from `hooks.json` files"）实现了 **10 个 lifecycle hook 事件**，与 Claude Code 高度对齐，且有 3 个 Claude 端没有的事件。

> 2026-06-07 落地更新：`spec-first init --codex` 已写入项目级 `.codex/hooks/session-start` 与 `.codex/hooks/hooks.json`，用于 startup 维度注入 `AGENTS.md` managed bootstrap 并 best-effort 运行 `startup-reminder --codex`。同时经计划核查确认 Codex `pre_compact`/`post_compact` 当前为 `StatelessHookOutcome`，不消费 `additionalContext`；因此 compact 后上下文重注入不能靠 Codex compact hook 实现，仍需保留 `AGENTS.md` 静态 fallback。

## Guidance

把 dual-host hook parity 当作可以做到的事，而不是不可达目标。具体地：

1. **认 10 个 Codex hook 事件**（来自 `codex-rs/hooks/src/lib.rs` 的 `HOOK_EVENT_NAMES`）：

   | Codex 事件 | Claude Code 对应 |
   | --- | --- |
   | `PreToolUse` | `PreToolUse` |
   | `PostToolUse` | `PostToolUse` |
   | `PermissionRequest` | （Claude 无） |
   | `PreCompact` | `PreCompact` |
   | `PostCompact` | （Claude 无） |
   | `SessionStart` | `SessionStart` |
   | `UserPromptSubmit` | `UserPromptSubmit` |
   | `SubagentStart` | （Claude 无） |
   | `SubagentStop` | `SubagentStop` |
   | `Stop` | `Stop` |

   8 个事件支持 matcher 字段（按 tool name 等过滤），与 Claude 的 matcher 模型对应；常量为 `HOOK_EVENT_NAMES_WITH_MATCHERS`。

2. **认 Codex hook 配置形态**：
   - 配置文件：`hooks/hooks.json`（plugin 层位于 `<plugin>/hooks/hooks.json`）。
   - 配置来源 5 层：`User` / `Project` / `Session` / `Plugin` / `Managed`。比 Claude Code 的 user/project 两层更细。
   - Handler 类型：`Prompt {}`、`Command { command, command_windows, timeout_sec, async, status_message }`（注意 `command_windows` 原生跨平台）、`Agent {}`。
   - 企业治理：`requirements.toml` 顶层 `allow_managed_hooks_only = true` 可锁为仅管理员/managed 层 hook，忽略 user/project/session 层。Claude Code 当前没有等价能力。

3. **更新 dual-host 设计原则的措辞**：保留"核心治理放 helper、hook 仅做 host-specific 锦上添花"这条结论，但把理由从"Codex 没有 hook"换成下面三条仍然成立的理由：
   - hook 是宿主 runtime 概念，宿主版本/行为细节/失败语义存在差异；
   - helper 是确定性事实层，跨宿主可复用、可单测、可 contract test；
   - hook 失败/缺失时 helper 仍在，保留 fail-safe。

4. **真正可以新增的 hook 用例**——这些场景以前被"Codex 没有 hook"挡住，现在解禁：
   - **PermissionRequest**（Codex 独有）在 mutation-capable GitNexus 调用前强制 preview-first；Claude 端用 `PreToolUse` matcher 等价兜底。
   - **PreCompact / PostCompact**（Codex 事件存在但当前为 `StatelessHookOutcome`）可做无上下文状态记录或提示类处理；**不能**用于重新注入 spec-first bootstrap context。compact 后恢复仍依赖 `AGENTS.md` 静态 fallback 或未来平台扩展。
   - **SubagentStart**（Codex 独有）在 reviewer / researcher dispatch 前注入 redaction policy 与 utilization 记录开关；Claude 端用主 agent 的 `PreToolUse` matcher=`Agent` 等价拦截。
   - **plugin 化**：Codex 的 Plugin 来源层意味着 spec-first 可作为 Codex plugin 发布，hook + skill 一起 ship。

5. **不要做的事**：不要因为 Codex 现在有 hook 就把核心治理（utilization metric、redaction policy、size cap、provenance 校验）从 helper 迁回 hook。helper-first 仍然是正确的；hook 仅做宿主特化的锦上添花。

## Why This Matters

- **避免基于过时假设做架构决策**。spec-first dual-host governance 中任何"Codex 无 hook 所以..."的推理都需要重新看一遍——结论可能仍正确，但理由必须更新，否则会在后续设计审查中被同样发现并需要再次返工。
- **打开新的设计空间**。`PermissionRequest` / `SubagentStart` 等事件 Claude Code 当前没有等价；spec-first 在 Codex 端可以做 Claude 端做不到的事（例如严格的 mutation gating、subagent 启动前的 redaction）。`PreCompact` / `PostCompact` 虽然存在，但当前 outcome 不消费 context，不能被当成 bootstrap 重注入通道。
- **影响 Codex 端模板与 init 行为**。如果以为 Codex 没有 hook，就不会有 `templates/codex/hooks/` 也不会让 `spec-first init --codex` 写 hook 配置；这条假设错位会持续阻塞 Codex 端 plugin 化和 dual-host 治理对称化。
- **训练知识可能仍过时**。截至 2026-05，多数 LLM 训练数据里的"Codex CLI 没有 PreToolUse hook"是历史事实但不是当前事实。任何依赖此事实的回答都应在调用前做一次 `gh api repos/openai/codex/contents/...` 校核（或读 `docs/config.md` 的 `## Lifecycle hooks` 节、`codex-rs/hooks/src/lib.rs`、`codex-rs/features/src/lib.rs` 中 `CodexHooks` 状态）。

## When to Apply

- 设计跨宿主 hook 注入、SessionStart bootstrap、compact 降级策略或 reviewer dispatch 前注入时。
- 评估 spec-first 是否要把 Claude 端的 SessionStart hook 在 Codex 端配齐对称模板。
- 评估 spec-first 作为 Codex plugin 发布的可行性（plugin 来源层带 hook 一起 ship）。
- 任何回答、文档或 brainstorm 中出现"Codex 无 hook"、"Codex 不支持 PreToolUse / PostToolUse"等措辞时，先校核当前 `openai/codex` 主分支再下结论。
- 评估 mutation-capable GitNexus 操作（`group_sync` / `rename` / 等）的硬门控放在哪一层——`PermissionRequest` 是 Codex 端的天然位置。

## Examples

### 校核 Codex hook 现状的最小命令

```bash
# 列出 hook 事件常量
gh api repos/openai/codex/contents/codex-rs/hooks/src/lib.rs \
  --jq '.content' | base64 -d | grep -A 14 "HOOK_EVENT_NAMES"

# 读 docs/config.md 的 Lifecycle hooks 节
gh api repos/openai/codex/contents/docs/config.md \
  --jq '.content' | base64 -d | grep -A 20 "## Lifecycle hooks"

# 看 feature flag 是否仍 Stable
gh api repos/openai/codex/contents/codex-rs/features/src/lib.rs \
  --jq '.content' | base64 -d | grep -B 2 -A 4 "CodexHooks"
```

### Codex hooks.json 形态（基于 source code 中观察到的 schema）

```json
{
  "hooks": {
    "session_start": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/abs/path/to/hook-script.sh"
          }
        ]
      }
    ],
    "pre_tool_use": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "..." }
        ]
      }
    ]
  }
}
```

注意事件名在 `hooks.json` 配置里使用 snake_case（`session_start`、`pre_tool_use` 等），常量 `HOOK_EVENT_NAMES` 中是 PascalCase。

### dual-host hook parity matrix（可作为后续 contract 起点）

| 行为 | Claude Code | Codex CLI |
| --- | --- | --- |
| Session 启动注入 spec-first bootstrap | `SessionStart` hook | `session_start` hook 或 `AGENTS.md` managed block |
| Tool 调用前注入 redaction 校验 | `PreToolUse` matcher | `pre_tool_use` matcher |
| Mutation 操作前强制 preview-first | `PreToolUse` + 自定义判定 | `permission_request` hook（更精确） |
| 压缩后恢复 bootstrap 上下文 | （Claude 仅有 `PreCompact`，需 prompt 续接） | `pre_compact`/`post_compact` 当前为 `StatelessHookOutcome`，不可注入 context；保留 `AGENTS.md` fallback |
| Reviewer dispatch 前注入 utilization 记录 | 主 agent `PreToolUse` matcher=`Agent` | `subagent_start` hook（更精确） |

## Related

- 当前 Claude 端 hook 实现：`templates/claude/hooks/session-start`、`.claude/settings.json`、`spec-first init --claude` 写入路径。
- 当前 Codex 端 startup hook 实现：`templates/codex/hooks/session-start`、`templates/codex/hooks/hooks.json`、`src/cli/adapters/codex.js`、`spec-first init --codex` 写入 `.codex/hooks/`。
- spec-first dual-host source-of-truth：`src/cli/contracts/dual-host-governance/skills-governance.json`（建议后续新增 `hook-parity-matrix.json` contract）。
- 上一份 dual-host 知识沉淀：`docs/solutions/architecture-patterns/workflow-entrypoint-exposure-contract-2026-04-26.md`。
- 上游来源：[`openai/codex` `docs/config.md` Lifecycle hooks 节](https://github.com/openai/codex/blob/main/docs/config.md)、[`codex-rs/hooks/src/lib.rs` HOOK_EVENT_NAMES](https://github.com/openai/codex/blob/main/codex-rs/hooks/src/lib.rs)、[`codex-rs/features/src/lib.rs` CodexHooks feature flag](https://github.com/openai/codex/blob/main/codex-rs/features/src/lib.rs)。
