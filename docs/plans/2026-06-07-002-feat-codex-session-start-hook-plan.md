---
spec_id: 2026-06-07-002-codex-session-start-hook
plan_depth: standard
status: active
origin: docs/brainstorms/2026-06-07-002-codex-session-start-hook-requirements.md
created: 2026-06-07
---

# feat: Codex SessionStart Hook 注入

为 Codex 宿主补全 SessionStart hook 注入能力，与 Claude 宿主对等。落地后 `spec-first init --codex` 写入 `.codex/hooks/` 下的 hook 脚本与配置，由 Codex 在会话启动时自动注入 `using-spec-first` 路由策略并自动运行 `startup-reminder --codex`；同时收敛 Codex bootstrap block 中因「无 hook」而存在的手动 reminder 指令。

Origin: `docs/brainstorms/2026-06-07-002-codex-session-start-hook-requirements.md`

---

## Problem Frame

Codex 端会话启动时，`using-spec-first` workflow 路由策略只能通过 `AGENTS.md` 的 managed bootstrap block 被动读取。`codex.js` adapter 的 `planRuntimeFilesSync` / `planRuntimeFilesRemoval` / `inspectRuntimeFiles` 均为空实现，`spec-first init --codex` 不写入任何 hook。长会话或 compact 后路由策略可能丢失，Codex 用户引导质量低于 Claude。

`docs/solutions/tooling-decisions/codex-cli-supports-lifecycle-hooks-2026-05-26.md` 已确认 Codex `CodexHooks` 为 Stable，支持 Claude-style lifecycle hooks。本计划补全这一能力。

---

## Direct Evidence

- target_repo: spec-first（当前仓库根）
- source_refs:
  - `src/cli/adapters/codex.js`（空 runtime-file 生命周期）
  - `src/cli/adapters/claude.js`（对称参照：`planRuntimeFilesSync`/`inspectRuntimeFiles`/`removeRuntimeFiles` + SESSION_START 常量与模板渲染）
  - `src/cli/adapters/base.js`（生命周期方法默认空实现契约）
  - `templates/claude/hooks/session-start`（脚本模板：读 bootstrap block + 调 startup-reminder + 输出 JSON）
  - `src/cli/instruction-bootstrap.js`（`buildZhBootstrapBody`/`buildEnBootstrapBody` 的 `codexStartupReminderLines`；`buildKnownBootstrapBodies`/`stripKnownBootstrapBodies` drift/清理基线）
  - `src/cli/commands/init.js:787,1744,2005`（无条件调用 `planRuntimeFilesSync` / `inspectRuntimeFiles`）
  - `src/cli/commands/clean.js:416`（无条件调用 `planRuntimeFilesRemoval`；line 399 的 `if (adapter.id === 'claude')` 仅清理 `.claude/settings.json` matcher）
  - `src/cli/commands/doctor.js:433`（无条件调用 `inspectRuntimeFiles`）
  - `src/cli/gitignore-policy.js:17`（`.codex/` 已整体忽略）
  - `codex-rs/hooks/src/events/session_start.rs`（openai/codex，confirmed-source：hook 输出契约）
- current_revision: 分支 `leo-2026-06-03-ceupdate`（工作树含既有未提交改动，与本计划无关）
- worktree_dirty: true（既有改动；本计划新增文件互不冲突）
- discovery_methods: 直接读源码、`grep`、`gh api` 读 openai/codex 源码
- tests_or_logs: 暂未运行；验证命令见各 Unit
- confidence: high（消费侧接入点已全部就绪，仅需填充 codex adapter 空方法 + 两个模板 + 一处 bootstrap 收敛）
- limitations: 未做 Codex live 会话验证；hook 实际注入行为依赖 Codex runtime，计划内以源码契约为准并保留纯文本 fallback

---

## Context & Research

### 关键接入点（全部已就绪，无需改消费侧）

| 消费点 | 位置 | 现状 | 本计划依赖 |
|---|---|---|---|
| init 写入 | `init.js:787,2005` | 无条件调 `adapter.planRuntimeFilesSync` | codex adapter 返回 hook 写入 ops |
| init 后校验 | `init.js:1744` | 无条件调 `adapter.inspectRuntimeFiles` | codex adapter 返回 hook 检查 |
| clean 清除 | `clean.js:416` | 无条件调 `adapter.planRuntimeFilesRemoval` | codex adapter 返回删除 ops |
| doctor 检查 | `doctor.js:433` | 无条件调 `adapter.inspectRuntimeFiles` | 同 init 校验，R4 自动满足 |
| gitignore | `gitignore-policy.js:17` | `.codex/` 已整体忽略 | BR4/OQ2 自动满足，**不改** |

消费侧零改动是本计划成立的核心：Claude adapter 已实现完整生命周期，Codex adapter 只是返回空。填充 codex adapter 即接通全部 init/clean/doctor 链路。

### Codex hook 输出契约（confirmed-source）

来自 `codex-rs/hooks/src/events/session_start.rs`：

- hook stdout 为 **合法 JSON** 时，消费 `hookSpecificOutput.additionalContext`（嵌套 camelCase，**与 Claude 完全一致**）；输出 JSON 内 event name 为 **PascalCase `SessionStart`**。
- hook stdout 为 **纯文本** 时，整段直接成为 model context（fallback 路径）。
- stdout **看起来像 JSON 但无效** 时，hook **fail**（不降级为 context）。→ 脚本必须输出合法 JSON，沿用 Claude 模板的 `JSON.stringify` 方式天然满足。
- `hooks.json` 配置层 event key 为 **snake_case `session_start`**（与输出 JSON 的 PascalCase 区分）。

> 这澄清并纠正了 origin PRD 的 OQ1 与 R2/R1 示例：输出 JSON event name 用 `SessionStart`（非 snake_case），配置 key 用 `session_start`。

### OQ 收敛

- OQ1（输出格式）→ 已解决（见上）。
- OQ2（gitignore）→ 已解决：`.codex/` 整体忽略，`.codex/hooks/` 自动包含，**不新增 gitignore 条目**。

---

## Requirements Traceability

| Origin | 计划归属 |
|---|---|
| R1 hook 脚本 | U1（模板）、U2（adapter 写入/校验） |
| R2 hooks.json | U1（模板）、U2（adapter 写入） |
| R3 adapter 生命周期 | U2 |
| R4 doctor 检查 | U2（复用 `inspectRuntimeFiles`，doctor 零改动） |
| R5 clean 清除 | U2（`planRuntimeFilesRemoval`，clean 零改动） |
| R6 bootstrap 收敛 | U3 |
| AC1-9 | U4（测试）覆盖 |

---

## Output Structure

```text
templates/codex/
└── hooks/
    ├── session-start        # 可执行脚本（mode 0755）
    └── hooks.json           # session_start 注册
```

---

## Implementation Units

### U1. 新增 Codex hook 模板

**Goal**：提供 Codex hook 的源模板（脚本 + 配置），供 codex adapter 渲染写入。

**Requirements**：R1, R2

**Dependencies**：无

**Files**：
- `templates/codex/hooks/session-start`（新增，可执行）
- `templates/codex/hooks/hooks.json`（新增）

**Approach**：
- `session-start` 脚本对称 `templates/claude/hooks/session-start`：
  - `#!/bin/bash` + `set -euo pipefail`
  - 读取 `AGENTS.md`（Codex instructionFile）的 `<!-- spec-first:bootstrap:start -->`..`end` block
  - 经由 `node` 内联脚本构造输出，`JSON.stringify` 保证合法 JSON，输出 `{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"..."}}`（PascalCase event name）
  - bootstrap block 缺失时输出降级 `additionalContext`（指引运行 `spec-first init`），exit 0
  - best-effort 调用 `spec-first startup-reminder --codex`（复用 `__SPEC_FIRST_CLI_PATH__` placeholder 与可信路径校验，对称 claude 模板的 `isTrustedSpecFirstCliPath`）；失败/超时不影响 exit code
  - 使用 `CODEX_PROJECT_DIR`(若 Codex 提供)否则 `pwd` 解析 project_dir，instruction_path 指向 `AGENTS.md`
- `hooks.json`：
  ```json
  {
    "hooks": {
      "session_start": [
        { "type": "command", "command": "<rendered>", "async": false }
      ]
    }
  }
  ```
  - command 指向 `.codex/hooks/session-start`（具体渲染形态由 U2 决定，与 claude SESSION_START_COMMAND 的 `$CLAUDE_PROJECT_DIR` 模式对齐，使用 Codex 等价变量或相对路径）

**Patterns to follow**：`templates/claude/hooks/session-start` 的内联 node + placeholder 替换 + 可信路径校验结构。

**Technical design**（directional guidance, not implementation spec）：
```text
project_dir = CODEX_PROJECT_DIR | pwd
instruction_path = project_dir/AGENTS.md
node <<EOF
  读 bootstrap block(start..end)
  存在 -> additionalContext = 注入说明 + block
  缺失 -> additionalContext = 降级指引
  best-effort: spawnSync(spec-first startup-reminder --codex)  # 失败忽略
  stdout = JSON.stringify({hookSpecificOutput:{hookEventName:'SessionStart', additionalContext}})
EOF
```

**Test scenarios**：脚本行为测试在 U4 统一覆盖（模板本身无独立运行入口，经 adapter 渲染后测试）。
Test expectation: none -- 纯模板文件，行为经 U2 渲染后由 U4 验证。

---

### U2. codex adapter 实现 runtime-file 生命周期

**Goal**：填充 `codex.js` 的 hook 写入/校验/删除，接通 init/clean/doctor 全链路。

**Requirements**：R1, R2, R3, R4, R5

**Dependencies**：U1

**Files**：
- `src/cli/adapters/codex.js`（修改：新增 hook 路径常量 + 实现 4 方法）
- `src/cli/commands/init.js`（小改：`printInitApplySuccess` 增加 codex hook 成功提示，对齐 claude 的 `🪝` 行）

**Approach**：
- 在 `codex.js` 顶部新增常量（对称 claude.js）：
  - `SESSION_START_TEMPLATE_PATH` → `templates/codex/hooks/session-start`
  - `HOOKS_JSON_TEMPLATE_PATH` → `templates/codex/hooks/hooks.json`
  - `SESSION_START_RELATIVE_PATH` → `.codex/hooks/session-start`
  - `HOOKS_JSON_RELATIVE_PATH` → `.codex/hooks/hooks.json`
  - 复用 claude 的 `__SPEC_FIRST_CLI_PATH__` placeholder 替换 + `TRUSTED_SPEC_FIRST_CLI_PATH` 注入模式
- `planRuntimeFilesSync(projectRoot)`：返回两条 operation（session-start 脚本 mode 0o755 + hooks.json），kind 按文件存在与否取 `write_file`/`update_file`，contents 由模板渲染（placeholder 替换）。复用 atomic write（init.js 执行层已用 `writeFileAtomic`）。
- `planRuntimeFilesRemoval()`：返回两条 `remove_file` operation。
- `inspectRuntimeFiles(projectRoot)`：对两文件做存在性 + 内容 drift 检查（对称 claude 的 `inspectSessionStartHook`），返回 PASS/WARNING 数组，fix 指向 `spec-first init`。
- `removeRuntimeFiles(projectRoot)`：删除两文件并清理空 `.codex/hooks/` 父目录（复用现有 `removeEmptyParents`）。保留现有 legacy 清理逻辑不动。
- init 成功提示：`printInitApplySuccess` 现有 `if (plan.platform === 'claude')` 旁增 codex 分支，输出 `🪝 Installed Codex SessionStart hook in .codex/hooks/`。

**Patterns to follow**：`claude.js` 的 `planRuntimeFilesSync`/`planRuntimeFilesRemoval`/`inspectRuntimeFiles`/`removeRuntimeFiles` + `renderSessionStartHookTemplate`/`inspectSessionStartHook` 整套结构。

**Test scenarios**（U4 实现，列此供 trace）：
- Covers AC1. `planRuntimeFilesSync` 在两文件缺失时产出 2 条 write_file op，session-start mode=0o755。
- Covers AC6. 两文件已存在且内容一致时为 update_file（幂等，无重复条目）。
- `inspectRuntimeFiles`：缺失→WARNING；存在且一致→PASS；内容漂移→WARNING。
- Covers AC5. `planRuntimeFilesRemoval` 产出 2 条 remove_file op。
- 渲染产物含 `hookSpecificOutput`/`SessionStart`，hooks.json 含 `session_start`。

**Verification**：`spec-first init --codex` 后 `.codex/hooks/session-start`(0755) 与 `hooks.json` 存在且内容匹配模板；`doctor --codex` 报 PASS；`clean --codex` 后 `.codex/hooks/` 不存在。

---

### U3. 收敛 Codex bootstrap block 的手动 reminder 行（R6）

**Goal**：移除 `codexStartupReminderLines` 第一行（指示 LLM 手动运行 `startup-reminder --codex`），使其与 hook 自动运行不重复；保留第二行（doc-review dispatch 授权）。

**Requirements**：R6

**Dependencies**：无（与 U1/U2 解耦，但语义上以 U2 落地为前提；可同 PR）

**Files**：
- `src/cli/instruction-bootstrap.js`（修改 `buildZhBootstrapBody`/`buildEnBootstrapBody`）

**Approach**：
- 在 `buildZhBootstrapBody` 与 `buildEnBootstrapBody` 的 `codexStartupReminderLines` 数组中，删除第一行（startup-reminder 手动运行指令），保留第二行（`$spec-doc-review` dispatch 授权）。
- 数组缩为单行后，确认 `codexStartupReminderLines ? ... : ''` 的拼接与换行仍正确（单行不再 `.join('\n')` 多行）。
- **drift 基线自洽**：`inspectInstructionBootstrap` 用 `buildBootstrapBlock(adapter,'zh'|'en')` 作期望值——同源函数，自动跟随，无需单独改。
- **历史 body 向后兼容**：`buildKnownBootstrapBodies` 当前只生成「当前」body。删除一行后，旧 AGENTS.md（含手动 reminder 行）的 body 将不在 known 集合中，导致 `stripKnownBootstrapBodies` 无法识别旧 block 进行替换/清理。**需在 `buildKnownBootstrapBodies` 中追加旧版 Codex body 字符串**（含手动 reminder 行的历史形态），保证 init 重装与 clean 能识别并替换旧写入。

**Patterns to follow**：现有 `buildKnownBootstrapBodies` 已用「显式枚举已知 body」模式做历史兼容，追加旧 body 字符串即可。

**Technical design**（directional）：
```text
buildKnownBootstrapBodies():
  for host in [claude, codex]:
    push zh(host), en(host)            # 当前形态
  push LEGACY_CODEX_ZH_WITH_REMINDER    # 新增:旧形态(含手动 reminder 行)
  push LEGACY_CODEX_EN_WITH_REMINDER
  dedupe
```

**Test scenarios**（U4）：
- Covers AC7. `init --codex` 后 AGENTS.md bootstrap 不含「best-effort 运行 spec-first startup-reminder --codex」行，仍含「$spec-doc-review 默认多 persona dispatch」行。
- Covers AC7. `inspectInstructionBootstrap` 对新 body 返回 installed（不报 drift）。
- Covers AC8. 给定含手动 reminder 行的旧 AGENTS.md，`applyManagedBootstrapBlock`/`removeManagedBootstrapBlock` 能正确识别并替换/清除旧 block（不残留）。
- zh 与 en 两种语言均覆盖。

**Verification**：新写入 AGENTS.md 内容符合预期；旧形态 body 仍可被 strip/replace；doctor 不误报 drift。

---

### U4. 测试覆盖

**Goal**：覆盖 AC1-9，防回归。

**Requirements**：AC1-9

**Dependencies**：U1, U2, U3

**Files**：
- `tests/unit/codex-session-start-hook.test.js`（新增：adapter 生命周期 + 渲染产物契约 + 幂等）
- `tests/unit/instruction-bootstrap.test.js`（扩展：R6 收敛 + 旧 body 兼容）
- `tests/unit/runtime-hook-permissions.test.js`（扩展：codex session-start mode 0o755）
- `tests/smoke/release-dual-host-governance.sh`（按需扩展：init --codex 写入 hook、clean --codex 清除）

**Approach**：以 adapter 单测为主（读当前磁盘 source，不受会话缓存影响）。模板脚本行为通过渲染产物字符串断言（含 `hookSpecificOutput`/`SessionStart`/降级分支）；如需端到端 stdout 行为，在 smoke 层用临时项目 `init --codex` 后执行脚本断言 JSON。

**Test scenarios**：
- Covers AC1. init plan 含 codex hook 写入 ops，脚本 mode 0o755。
- Covers AC2/AC3. 渲染脚本：bootstrap 存在→合法 JSON 含 block；缺失→降级 JSON，exit 0。
- Covers AC4. `inspectRuntimeFiles` 缺失/存在/漂移三态。
- Covers AC5. clean plan 含 2 条 remove_file。
- Covers AC6. 重复 init 幂等（update_file，无重复）。
- Covers AC7/AC8. bootstrap 收敛 + 旧 body 兼容（见 U3）。
- Covers AC9. 现有 Claude 链路测试全绿（运行既有 suite）。

**Verification**：`npm run test:unit` 与 `npm run test:smoke` 通过；新增断言覆盖上述场景。

---

## System-Wide Impact

- **双宿主对称**：Codex 获得与 Claude 对等的 hook 注入；`AGENTS.md`/`CLAUDE.md` 静态 block 继续作为 fallback。
- **init/clean/doctor**：无消费侧逻辑改动，仅 codex adapter 行为从「空」变「有」。
- **CHANGELOG**：需新增条目（user-visible：`spec-first init --codex` 现在安装 SessionStart hook）。
- **文档**：`docs/solutions/tooling-decisions/codex-cli-supports-lifecycle-hooks-2026-05-26.md` 可补一条「已落地」回链（可选）；README 双宿主说明如提及 Claude hook 独有，需同步。

---

## Risks & Mitigation

| 风险 | 缓解 |
|---|---|
| Codex hook 输出格式与假设不符 | 已 confirmed-source 核对；脚本用合法 JSON，最坏情况 Codex 也支持纯文本 stdout fallback |
| 无效类 JSON stdout 导致 hook fail | 沿用 `JSON.stringify`，绝不手拼 JSON；降级分支也走 stringify |
| R6 删行破坏旧 AGENTS.md 清理 | U3 显式追加旧 body 到 `buildKnownBootstrapBodies`，AC8 守护 |
| startup-reminder 调用阻塞会话 | best-effort + timeout，失败忽略（对称 claude，NFR1 < 1200ms） |
| Codex 环境变量名（CODEX_PROJECT_DIR）未确认 | 脚本 `CODEX_PROJECT_DIR:-$(pwd)` 兜底；hooks.json command 用相对/等价变量，U4 smoke 验证 |

---

## Assumptions

- `[confirmed]` Codex hook 输出消费 `hookSpecificOutput.additionalContext`，配置 key `session_start`，输出 event name `SessionStart`（source: codex-rs）。
- `[advisory]` Codex 在 startup 触发 session_start（与 Claude startup 等价）；compact 重注入依赖 Codex 平台行为，明确为 Non-Goal。
- `[advisory]` `CODEX_PROJECT_DIR` 为 Codex 提供的项目根变量；未确认时脚本用 `pwd` 兜底，smoke 层验证实际行为。

---

## Scope Boundaries

### 本计划范围
- 新增 Codex hook 模板与 adapter 生命周期实现
- doctor/clean 经既有接入点自动接通
- Codex bootstrap block R6 收敛 + 历史兼容
- 测试与 CHANGELOG

### Deferred to Follow-Up Work
- Cursor / Copilot CLI 等新平台 adapter 与 hook（origin Non-Goal）
- Codex compact 事件重注入（依赖平台行为，origin Non-Goal）

### Outside this product's identity
- 修改 Claude adapter / claude-settings.js / Claude session-start 模板（已完整）
- 消除「静态 block + hook 动态注入」双重注入（对抗 compact 的有意设计）

---

## Deferred Implementation Notes

- `hooks.json` 中 `command` 的最终渲染形态（绝对路径 vs `$CODEX_PROJECT_DIR` 相对）在 U2 实现时依据 Codex command 展开行为定稿；以 smoke 验证为准。
- session-start 脚本是否需要 `command_windows` 字段（Codex 原生跨平台）——本计划先做 bash 版，Windows parity 留作后续（如 CHANGELOG/issue 跟踪）。

---

## Verification Plan

- `npm run typecheck`
- `npm run test:unit`（含新增 `codex-session-start-hook.test.js` + 扩展的 bootstrap/permissions 测试）
- `npm run test:smoke`（dual-host governance）
- 手动：临时项目 `spec-first init --codex` → 查 `.codex/hooks/` 两文件 → 执行 session-start 脚本断言 JSON → `doctor --codex` PASS → `clean --codex` 清空
- AC9：既有 Claude 链路测试全绿（无回归）
