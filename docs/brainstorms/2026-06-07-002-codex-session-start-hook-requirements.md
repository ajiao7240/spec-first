---
date: 2026-06-07
topic: codex-session-start-hook
spec_id: 2026-06-07-002-codex-session-start-hook
artifact_kind: prd-requirements
---

# Codex SessionStart Hook 注入

## Summary

为 Codex 宿主补全 SessionStart hook 注入能力，使其与 Claude 宿主的 `using-spec-first` bootstrap 注入机制对等。当前 Codex 端依赖 `AGENTS.md` 静态文本被动读取，缺乏动态上下文注入；`spec-first init --codex` 执行后不写入任何 hook 文件。

## Problem Statement

**现象**：在 Codex 宿主中，会话启动时 spec-first workflow 路由策略（`using-spec-first` bootstrap block）只能通过 `AGENTS.md` 的 managed block 被动传递。如果 `AGENTS.md` 被用户修改、compact 发生后上下文截断，或 startup-reminder CLI 调用失败，路由策略就会静默丢失。

**根因**：`codex.js` adapter 的 `planRuntimeFilesSync` / `removeRuntimeFiles` / `inspectRuntimeFiles` 均为空实现；`templates/` 下无 `codex/hooks/` 目录；`spec-first init --codex` 不写入任何 hook 文件。

**业务影响**：Codex 用户在长会话或 compact 后可能丢失 workflow 路由策略，退回到无 spec-first 引导的默认行为，导致用户引导质量低于 Claude 宿主。

## Current System Snapshot

- `src/cli/adapters/claude.js`（confirmed-source）：实现完整 hook 生命周期——`planRuntimeFilesSync` 写入 `.claude/hooks/session-start`，`inspectRuntimeFiles` 检查 hook 状态，`removeRuntimeFiles` 删除 hook 文件；`claude-settings.js` 管理 `.claude/settings.json` 的 SessionStart matcher（`startup|resume|clear|compact`）。
- `src/cli/adapters/codex.js`（confirmed-source）：`planRuntimeFilesSync()`、`planRuntimeFilesRemoval()`、`inspectRuntimeFiles()` 均返回空结果；`removeRuntimeFiles` 只清理旧 legacy 目录，无 hook 相关操作。
- `templates/claude/hooks/session-start`（confirmed-source）：读取 `CLAUDE.md` bootstrap block，输出 `hookSpecificOutput.additionalContext` JSON。
- `docs/solutions/tooling-decisions/codex-cli-supports-lifecycle-hooks-2026-05-26.md`（confirmed-source）：Codex `CodexHooks` feature flag 已标记 Stable；hook 配置文件为 `hooks/hooks.json`，事件名使用 snake_case（`session_start`）；Handler 类型支持 `Command { command, command_windows, timeout_sec, async }`；5 层配置来源（User/Project/Session/Plugin/Managed）。
- `src/cli/instruction-bootstrap.js`（confirmed-source）：Codex 端 bootstrap block 写入 `AGENTS.md`；`startup-reminder --codex` 为 best-effort，失败不阻塞。
- `src/cli/commands/doctor.js`（confirmed-source）：`inspectManagedSessionStartHook` 只检查 Claude 的 `.claude/settings.json`，无 Codex hook 检查分支（`doctor --codex` 路径无 SessionStart 检查）。
- `src/cli/instruction-bootstrap.js` 的 `buildZhBootstrapBody`/`buildEnBootstrapBody`（confirmed-source）：Claude 与 Codex 的 bootstrap body 内容本就不同。Claude body 无"手动运行 startup-reminder"指令（因 hook 自动运行）；Codex body 多出 `codexStartupReminderLines` 两行，其中第一行指示 LLM best-effort 手动运行 `startup-reminder --codex`，存在前提正是 Codex 当前无 hook。

### Claude 端检查结论（无需改动）

Claude 端 SessionStart hook 链路完整，本 PRD 不修改：
- matcher `startup|resume|clear|compact` 含 compact 重注入，比 superpowers 的 `startup|clear|compact` 多 `resume`。
- session-start 脚本读取 CLAUDE.md bootstrap block + 调用 `startup-reminder --claude`，输出 `hookSpecificOutput.additionalContext`。
- adapter 的 plan/inspect/remove 生命周期齐全。
- 静态 CLAUDE.md bootstrap block 与 hook 动态注入构成"双重注入"，为对抗 compact 后上下文压缩的有意设计，两端对称保留，不消除。

## Change Delta

**topology**: extend（在现有 Codex adapter 上补全 hook 注入能力，不替换现有 AGENTS.md 静态注入）

新增：
- `templates/codex/hooks/session-start`（可执行脚本）
- `templates/codex/hooks/hooks.json`
- `codex.js` adapter 的 hook 生命周期实现
- `doctor --codex` 的 SessionStart hook 检查

保留：`AGENTS.md` managed bootstrap block 作为 fallback（hook 失败或未安装时的静默降级）。

## Requirements

### R1 — templates/codex/hooks/session-start 脚本

spec-first init --codex 执行后，`.codex/hooks/session-start` 脚本须存在且可执行。

脚本行为：
- 读取 `AGENTS.md` 的 `<!-- spec-first:bootstrap:start -->` 到 `<!-- spec-first:bootstrap:end -->` 之间的 bootstrap block
- bootstrap block 存在时，输出 `hookSpecificOutput.additionalContext` JSON（与 Claude 端格式一致）
- bootstrap block 缺失时，输出降级提示（指引用户运行 `spec-first init`），不静默退出
- 同时调用 `spec-first startup-reminder --codex`（best-effort，失败不影响 hook 退出码）
- 脚本须兼容 bash（`#!/bin/bash` + `set -euo pipefail`）

**验收示例**：
```
# bootstrap block 存在
$ .codex/hooks/session-start
{"hookSpecificOutput":{"hookEventName":"session_start","additionalContext":"[spec-first] ..."}}
exit 0

# bootstrap block 缺失
$ .codex/hooks/session-start
{"hookSpecificOutput":{"hookEventName":"session_start","additionalContext":"[spec-first] bootstrap block missing. Run spec-first init."}}
exit 0
```

### R2 — templates/codex/hooks/hooks.json

`spec-first init --codex` 执行后，`.codex/hooks/hooks.json` 须存在，内容为：

```json
{
  "hooks": {
    "session_start": [
      {
        "type": "command",
        "command": "$CODEX_PROJECT_DIR/.codex/hooks/session-start",
        "async": false
      }
    ]
  }
}
```

事件名使用 snake_case（`session_start`），符合 Codex hooks.json schema。

### R3 — codex.js adapter hook 生命周期

`codex.js` adapter 须实现以下方法，对称 claude.js：

- `planRuntimeFilesSync(projectRoot)`：返回写入 `.codex/hooks/session-start`（mode 0o755）和 `.codex/hooks/hooks.json` 的 operation plan
- `planRuntimeFilesRemoval()`：返回删除上述两个文件的 operation plan
- `inspectRuntimeFiles(projectRoot)`：检查两个文件是否存在且内容未漂移，返回 PASS / WARNING / ERROR check 数组
- `removeRuntimeFiles(projectRoot)`：删除 `.codex/hooks/session-start` 和 `.codex/hooks/hooks.json`，清理空父目录

hook 文件路径常量集中在 `codex.js`，不散落在 init.js。

### R4 — doctor --codex SessionStart 检查

`spec-first doctor --codex` 须新增 SessionStart hook 检查项：
- `.codex/hooks/session-start` 缺失 → WARNING，fix 提示运行 `spec-first init`
- `.codex/hooks/hooks.json` 缺失 → WARNING，fix 提示运行 `spec-first init`
- 文件存在但内容漂移 → WARNING，fix 提示运行 `spec-first init`
- 两者均正常 → PASS

检查逻辑复用 adapter 的 `inspectRuntimeFiles`，doctor.js 无需感知 hook 文件路径细节。

### R5 — spec-first clean --codex 清除 hook 文件

`spec-first clean --codex` 执行后，`.codex/hooks/session-start` 和 `.codex/hooks/hooks.json` 须被删除；若 `.codex/hooks/` 目录因此变为空目录，也须删除。

### R6 — Codex bootstrap block 内容随 hook 落地而收敛

`instruction-bootstrap.js` 的 `buildZhBootstrapBody` / `buildEnBootstrapBody` 中，Codex 专属的 `codexStartupReminderLines` 第一行（指示 LLM "进入公开 `$spec-*` 前可 best-effort 运行 `spec-first startup-reminder --codex`"）须移除。

**理由**：该行存在的唯一前提是 Codex 当前没有 hook，只能让 LLM 手动运行 startup-reminder。R1 落地后，session_start hook 自动调用 `startup-reminder --codex`（对齐 Claude 端 session-start 脚本），继续指示 LLM 手动运行会造成冗余与职责矛盾——LLM 不应被指示去做一件 hook 已经自动完成的事。

**保留**：`codexStartupReminderLines` 第二行（关于 `$spec-doc-review` 多 persona dispatch 授权）与 startup-reminder 无关，不在本需求范围，须原样保留。

**对齐目标**：移除后 Codex bootstrap body 与 Claude bootstrap body 在 startup-reminder 维度对称——两端都不再于 bootstrap 文本里指示手动运行 reminder，因为两端都由 hook 自动运行。

**涟漪一致性**：此变更会同时影响 `AGENTS.md` 实际写入内容、`inspectInstructionBootstrap` 的 drift 比对基线（`buildBootstrapBlock` 的 zh/en 期望值）、以及 `stripKnownBootstrapBodies` / `buildKnownBootstrapBodies` 的历史 body 清理集合。须保证 init 幂等、doctor drift 检查不误报、旧 bootstrap body 仍可被 clean/重装正确识别和替换。

**验收示例**：
```
# init --codex 后，AGENTS.md bootstrap block 不再包含 "best-effort 运行 spec-first startup-reminder --codex" 这一行
# 但仍包含 "$spec-doc-review 默认多 persona dispatch" 这一行
```

## Non-Goals

- 不修改 Claude adapter、claude-settings.js 或 Claude 端 session-start 模板（已完整，见 Current System Snapshot 的 Claude 端检查结论）
- 不修改 Claude bootstrap body 内容（Claude 端本就无手动 startup-reminder 指令，无需收敛）
- 不引入 Cursor / Copilot CLI / 其他新平台 adapter
- 不删除 AGENTS.md / CLAUDE.md 的 managed bootstrap block（保留为 hook 失败/未装时的 fallback）
- 不消除"静态文本 + hook 动态注入"的双重注入（对抗 compact 的有意设计）
- 不移除 Codex `codexStartupReminderLines` 第二行（`$spec-doc-review` dispatch 授权，与 hook 无关）
- 不修改 `hooks.json` 的 matcher 逻辑（Codex hook schema 无 matcher 字段）
- 不处理 `compact` 事件重注入（Codex 的 `session_start` 在 startup 触发，compact 重注入依赖 Codex 平台行为，不在本 PRD 范围）

## Business Rules

- BR1：hook 文件须由 `spec-first init --codex` 写入，不得手改 generated runtime assets
- BR2：hook 脚本失败（exit non-zero）不得阻塞 Codex 会话启动；脚本须在 AGENTS.md bootstrap block 缺失时静默降级而非 crash
- BR3：`spec-first init --codex` 幂等——重复执行不产生重复 hook 注册
- BR4：hook 文件路径（`.codex/hooks/`）须纳入 `.gitignore` 的 spec-first managed block

## NFRs

- NFR1：session-start 脚本执行时间 < 1200ms（与 Claude 端 startup-reminder timeout 对齐）
- NFR2：hook 文件写入使用 atomic write（与 claude.js 一致）
- NFR3：跨平台：session-start 脚本使用 bash，不依赖 node；若需要 node 路径，通过 `$SPEC_FIRST_CLI_PATH` placeholder 注入（与 Claude 端 template 模式一致）

## Evidence And Assumptions

- `[assumption]` Codex `session_start` hook 在 `startup` 时触发（与 Claude `SessionStart` + `startup` matcher 等价）；基于 `codex-cli-supports-lifecycle-hooks-2026-05-26.md` 的 source code 分析，未做 live 验证
- `[assumption]` Codex hook 输出格式为 `hookSpecificOutput.additionalContext`（与 Claude 相同）；基于 superpowers session-start 脚本对 `CLAUDE_PLUGIN_ROOT` 的平台判断逻辑推断
- `[confirmed-source]` Codex hooks.json 事件名使用 snake_case（`session_start`）—— `codex-cli-supports-lifecycle-hooks-2026-05-26.md` 明确记录
- `[confirmed-source]` Codex hook command 字段支持环境变量展开（`$CODEX_PROJECT_DIR`）—— 基于 superpowers hooks-cursor.json 的 `./hooks/run-hook.cmd` 相对路径模式推断，需验证

## Outstanding Questions

- OQ1：Codex `session_start` hook 的输出 JSON 字段名是否与 Claude 完全相同（`hookSpecificOutput.additionalContext`）？需在实现阶段通过 Codex source 或 live 测试确认；若不同，需调整脚本输出格式
- OQ2：`.codex/hooks/` 是否已在 Codex gitignore 策略中，或需要在 spec-first gitignore managed block 中新增？

## Acceptance Criteria

1. `spec-first init --codex` 在空项目执行后，`.codex/hooks/session-start`（mode 0o755）和 `.codex/hooks/hooks.json` 均存在且内容与模板一致
2. `.codex/hooks/session-start` 在 `AGENTS.md` bootstrap block 存在时输出合法 JSON，`hookSpecificOutput.additionalContext` 包含 bootstrap block 内容
3. `.codex/hooks/session-start` 在 `AGENTS.md` bootstrap block 缺失时输出降级 JSON，exit 0
4. `spec-first doctor --codex` 在 hook 文件缺失时报 WARNING，存在且正常时报 PASS
5. `spec-first clean --codex` 后 `.codex/hooks/` 目录不存在
6. `spec-first init --codex` 幂等（重复执行不产生重复条目）
7. `spec-first init --codex` 后 `AGENTS.md` bootstrap block 不再含"手动 best-effort 运行 `startup-reminder --codex`"行，但仍含 `$spec-doc-review` dispatch 授权行；`doctor --codex` 对该新 bootstrap body 不报 drift
8. 旧版（含手动 startup-reminder 行）的 Codex bootstrap body 仍能被 `spec-first init` / `clean` 正确识别并替换/清除（向后兼容历史写入）
9. 现有 Claude 端 unit / smoke / integration 测试全部通过（无回归）
