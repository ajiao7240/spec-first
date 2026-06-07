---
spec_id: 2026-06-07-002-codex-session-start-hook
plan_depth: standard
status: completed
origin: docs/brainstorms/2026-06-07-002-codex-session-start-hook-requirements.md
created: 2026-06-07
---

# feat: Codex SessionStart Hook 注入

为 Codex 宿主补全 SessionStart hook 注入能力，在 **startup 维度**与 Claude 宿主对齐。落地后 `spec-first init --codex` 写入 `.codex/hooks/` 下的 hook 脚本与配置，由 Codex 在会话启动时自动注入 `using-spec-first` 路由策略并自动运行 `startup-reminder --codex`；待 hook 触发经 live 验证后，再收敛 Codex bootstrap block 中因「无 hook」而存在的手动 reminder 指令。

> **范围诚实声明**：Codex 的 compact 事件（`pre_compact`/`post_compact`）在源码中是 `StatelessHookOutcome`，不消费 `additionalContext`（对比 `session_start` 有完整 context 注入路径）。因此 **compact 后重注入在 Codex 平台层不可行**，这是平台限制下的 parity gap，而非本计划主动放弃。本计划交付 startup 维度对齐 + dual-host 注入基础设施，见 System-Wide Impact。

Origin: `docs/brainstorms/2026-06-07-002-codex-session-start-hook-requirements.md`

---

## Problem Frame

Codex 端会话启动时，`using-spec-first` workflow 路由策略只能通过 `AGENTS.md` 的 managed bootstrap block 被动读取。`codex.js` adapter 的 `inspectRuntimeFiles` 为空实现，且 `planRuntimeFilesSync` / `planRuntimeFilesRemoval` 当前只返回 legacy 目录清理 ops（无 hook 写入）；`spec-first init --codex` 不写入任何 hook。Codex startup 阶段缺乏与 Claude 对齐的确定性、结构化注入点，dual-host 注入一致性缺失。

> origin Problem Statement 含「compact 后路由丢失」根因。本计划已核查：该痛点的 compact 半边在 Codex 平台层无法用 hook 解决（compact 事件不消费 context），只能依赖 AGENTS.md 被动重载；本计划解决 startup 半边并建立 dual-host 注入基础设施。

`docs/solutions/tooling-decisions/codex-cli-supports-lifecycle-hooks-2026-05-26.md` 已确认 Codex `CodexHooks` 为 Stable，支持 Claude-style lifecycle hooks。本计划补全 startup 注入能力。

---

## Direct Evidence

- target_repo: spec-first（当前仓库根）
- source_refs:
  - `src/cli/adapters/codex.js:119-138`（`inspectRuntimeFiles` 返回 `[]`；`planRuntimeFilesSync`/`planRuntimeFilesRemoval` 返回 `buildRuntimeCleanupOperations` 的 6 条 legacy `remove_dir` ops——**非空**，需追加而非替换）
  - `src/cli/adapters/claude.js`（对称参照：`planRuntimeFilesSync`/`inspectRuntimeFiles`/`removeRuntimeFiles` + SESSION_START 常量与模板渲染）
  - `src/cli/adapters/base.js`（生命周期方法默认空实现契约）
  - `templates/claude/hooks/session-start`（脚本模板：读 bootstrap block + 调 startup-reminder + 输出 JSON）
  - `src/cli/instruction-bootstrap.js`（`buildZhBootstrapBody`/`buildEnBootstrapBody` 的 `codexStartupReminderLines`；`stripManagedBootstrapSections` 按标题+bullet+anchor 做 section-level strip；`buildKnownBootstrapBodies`/`stripKnownBootstrapBodies` body 精确匹配清理基线）
  - `src/cli/commands/init.js:787,1744,2005`（无条件调用 `planRuntimeFilesSync` / `inspectRuntimeFiles`）
  - `src/cli/commands/clean.js:416`（无条件调用 `planRuntimeFilesRemoval`；line 399 的 `if (adapter.id === 'claude')` 仅清理 `.claude/settings.json` matcher）
  - `src/cli/commands/doctor.js:433`（无条件调用 `inspectRuntimeFiles`）
  - `src/cli/gitignore-policy.js:17`（`.codex/` 已整体忽略）
  - `codex-rs/hooks/src/events/session_start.rs`、`compact.rs`、`config.rs`/tooling-decisions 文档（openai/codex，confirmed-source：hook 输出契约 + hooks.json 嵌套 schema + compact 事件 StatelessHookOutcome）
- current_revision: 分支 `leo-2026-06-03-ceupdate`（工作树含既有未提交改动，与本计划无关）
- worktree_dirty: true（既有改动；本计划新增文件互不冲突）
- discovery_methods: 直接读源码、`grep`、`gh api` 读 openai/codex 源码
- confidence: medium-high（wiring 层 confidence high：消费侧接入点就绪；runtime 层 confidence medium：Codex hook 实际触发/注入行为依赖平台，未做 live 验证，见 limitations）
- limitations:
  - 未做 Codex live 会话验证；hook 实际触发与 `additionalContext` 注入依赖 Codex runtime，计划内以源码契约 + 脚本执行测试为准，并保留 AGENTS.md 静态 bootstrap fallback
  - compact 维度 parity gap：Codex `pre_compact`/`post_compact` 为 `StatelessHookOutcome`，源码无 `additional_context` 字段，平台层不支持 compact 后 context 重注入（compact 半边只能依赖 AGENTS.md 被动重载）

---

## Context & Research

### 关键接入点（全部已就绪，无需改消费侧）

| 消费点 | 位置 | 现状 | 本计划依赖 |
|---|---|---|---|
| init 写入 | `init.js:787,2005` | 无条件调 `adapter.planRuntimeFilesSync` | codex adapter **追加** hook 写入 ops 到现有 legacy ops |
| init 后校验 | `init.js:1744` | 无条件调 `adapter.inspectRuntimeFiles` | codex adapter 返回 hook 检查 |
| clean 清除 | `clean.js:416` | 无条件调 `adapter.planRuntimeFilesRemoval` | codex adapter **追加** hook 删除 ops 到现有 legacy ops |
| doctor 检查 | `doctor.js:433` | 无条件调 `adapter.inspectRuntimeFiles` | 同 init 校验，R4 自动满足 |
| gitignore | `gitignore-policy.js:17` | `.codex/` 已整体忽略 | BR4/OQ2 自动满足，**不改** |

消费侧**核心逻辑零改动**：init/clean/doctor 的接入点不变，Claude adapter 已实现完整生命周期，codex adapter 填充后即接通全部链路。唯一例外是 `init.js` 的 `printInitApplySuccess` 新增一行 codex 成功提示（与 claude 的 `🪝` 行对称，UX 反馈），这是有意纳入的小改动，见 U2。

> **关键纠正**：codex adapter 并非「全空」。`planRuntimeFilesSync`/`planRuntimeFilesRemoval` 当前返回 6 条 legacy `remove_dir` 清理 ops（存量用户从旧布局升级的迁移路径），只有 `inspectRuntimeFiles` 真空。本计划必须 **追加** hook ops 到现有 ops 之上，**不可替换**，否则破坏升级清理。

### Codex hook 输出契约（confirmed-source）

来自 `codex-rs/hooks/src/events/session_start.rs`：

- hook stdout 为 **合法 JSON** 时，消费 `hookSpecificOutput.additionalContext`（嵌套 camelCase，**与 Claude 完全一致**）；输出 JSON 内 event name 为 **PascalCase `SessionStart`**。
- hook stdout 为 **纯文本** 时，整段直接成为 model context（fallback 路径）。
- stdout **看起来像 JSON 但无效** 时，hook **fail**（不降级为 context）。→ 脚本必须输出合法 JSON，沿用 Claude 模板的 `JSON.stringify` 方式天然满足。

### Codex hooks.json 配置 schema（confirmed-source，**嵌套形态**）

来自 tooling-decisions 文档（基于 codex 源码观察）+ `lib.rs` 事件名映射：

```json
{
  "hooks": {
    "session_start": [
      {
        "hooks": [
          { "type": "command", "command": "/abs/path/to/.codex/hooks/session-start" }
        ]
      }
    ]
  }
}
```

- **嵌套结构**：`event_key -> [ { (可选 matcher,) hooks: [ {type, command} ] } ]`，与 Claude 的 matcher-group→hooks-array 同构。`async` 是内层 Command 字段。
- 配置层 event key 为 **snake_case `session_start`**（输出 JSON 的 event name 才是 PascalCase `SessionStart`）。
- 文档示例 command 用 **绝对路径**。
- compact 事件 key 为 `pre_compact`/`post_compact`，但其 outcome 为 `StatelessHookOutcome`，**不消费 additionalContext**，不可用于 context 重注入。

> 这澄清并纠正了 origin PRD 的 OQ1 与 R1/R2 示例：(1) 输出 JSON event name 用 `SessionStart`（非 snake_case），配置 key 用 `session_start`；(2) hooks.json 是**嵌套**形态（内层 `hooks` 数组），非扁平。

### OQ 收敛

- OQ1（输出格式）→ 已解决（见上）。
- OQ2（gitignore）→ 已解决：`.codex/` 整体忽略，`.codex/hooks/` 自动包含，**不新增 gitignore 条目**。

---

## Requirements Traceability

| Origin | 计划归属 |
|---|---|
| R1 hook 脚本 | U1（模板）、U2（adapter 写入/校验） |
| R2 hooks.json | U1（模板，嵌套形态）、U2（adapter 写入） |
| R3 adapter 生命周期 | U2 |
| R4 doctor 检查 | U2（复用 `inspectRuntimeFiles`，doctor 零改动） |
| R5 clean 清除 | U2（`planRuntimeFilesRemoval` 追加 hook ops，clean 零改动） |
| R6 bootstrap 收敛 | U3（**follow-up gate**：hook 触发 live 验证通过后再删手动 reminder；无 live 证据时不与 U1/U2 同批执行） |
| AC1, AC5, AC6（adapter 文件操作） | U2 产出，U4 断言 |
| AC7, AC8（bootstrap body 收敛/兼容） | U3 产出，U4 断言；若 U3 deferred，则 AC7/AC8 同步 deferred |
| AC2, AC3, AC4, AC9（脚本行为/校验/回归） | U4 |

> AC2/AC3 的 event name 以本计划为准（PascalCase `SessionStart`）；origin PRD 示例的 snake_case 残留已回写修正。

---

## Output Structure

```text
templates/codex/
└── hooks/
    ├── session-start        # 可执行脚本（mode 0755），含 __SPEC_FIRST_CLI_PATH__ placeholder
    └── hooks.json           # session_start 嵌套注册，command 为渲染后绝对路径
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
- `hooks.json`（**嵌套形态**，见 Context 的 confirmed-source schema）：
  ```json
  {
    "hooks": {
      "session_start": [
        { "hooks": [ { "type": "command", "command": "<rendered-abs-path>" } ] }
      ]
    }
  }
  ```
  - command 为 **渲染后绝对路径**（`<projectRoot>/.codex/hooks/session-start`），由 U2 在 `planRuntimeFilesSync` 渲染时写入，对称 claude 模板示例与文档示例。不赌 `$CODEX_PROJECT_DIR` 在 command 字段的展开行为。
  - **配置层级 = 项目级（Project 层）**：写入项目内 `.codex/hooks/hooks.json`，**不写** 用户级 `~/.codex/`。Codex hook 有 5 层来源（User/Project/Session/Plugin/Managed），本计划只用 Project 层——与 Claude 端 `.claude/settings.json` 项目级注册、`codex.js` 类注释 `Codex support is project-scoped`、以及注入内容是 per-project 路由治理（含 `target_repo` 边界，放用户级会污染非 spec-first 项目）三者一致。`spec-first clean --codex` 也只清项目内 Project 层文件，不触碰任何用户级配置。

**信任边界声明**（安全 reviewer 要求，trusted-by-design）：
- AGENTS.md bootstrap block 与 hook 脚本同源（均由 spec-first 管理），其内容按 **「仓库写权限 = 信任边界」** 模型处理：能改 AGENTS.md 的主体也能改 hook 脚本本身，故 hook 直接注入 bootstrap block 不引入额外信任降级。注入前经 `JSON.stringify` 转义，封堵 block 内容破坏 hook 控制字段（如伪造 `continue:false`）。
- `startup-reminder --codex` 的 stdout 来自 spec-first 自身 CLI（内部可信，非外部输入），拼接前无需额外过滤；其路径经 `isTrustedSpecFirstCliPath` 校验后才 spawnSync。

**Patterns to follow**：`templates/claude/hooks/session-start` 的内联 node + placeholder 替换 + 可信路径校验结构。

**Technical design**（directional guidance, not implementation spec）：
```text
project_dir = CODEX_PROJECT_DIR | pwd
instruction_path = project_dir/AGENTS.md
node <<EOF
  读 bootstrap block(start..end)
  存在 -> additionalContext = 注入说明 + block
  缺失 -> additionalContext = 降级指引
  best-effort: spawnSync(spec-first startup-reminder --codex)  # 路径经可信校验; 失败忽略
  stdout = JSON.stringify({hookSpecificOutput:{hookEventName:'SessionStart', additionalContext}})
EOF
```

**注入内容契约（Injected Content Contract）**

`additionalContext` 分三层，每层 source-of-truth 唯一，hook 是**搬运工不是作者**——不复制、不另造任何正文。输出 JSON 的 `hookEventName` 恒为 PascalCase `SessionStart`。

| 层 | 内容 | source-of-truth | hook 角色 |
|---|---|---|---|
| **正文** | bootstrap block 全文（含 marker） | `instruction-bootstrap.js` 的 `build{Zh,En}BootstrapBody('codex')` → 写入 `AGENTS.md` | 按 marker 逐字回读，零改写 |
| **包裹** | 引导句 / 降级句 / 拼接 / JSON 信封 | `templates/claude/hooks/session-start` | Codex 模板镜像，按下表替换 3 处 |
| **追加** | 版本/runtime 提醒 | `spec-first startup-reminder --codex` | best-effort 搬运 |

**包裹层差异（Codex 模板相对 Claude 模板的全部改动）**：

| Claude 模板 | Codex 模板 |
|---|---|
| 引导/降级句中的 `CLAUDE.md` | `AGENTS.md` |
| 降级句 `choose Claude Code when prompted` | `choose Codex when prompted` |
| `startup-reminder --claude` | `startup-reminder --codex` |

除此三处外，包裹层的三分支结构、文案、拼接顺序、信任校验逻辑与 Claude 模板**逐字相同**，不在此重述（见 `templates/claude/hooks/session-start`）。

**三分支行为**（文案 own 在 Claude 模板，此处只声明语义）：
- **正常**：marker 完整 → 引导句 + 空行 + 正文（逐字回读）。
- **缺失**：marker 全缺 → `missing from AGENTS.md` 降级句 + `spec-first init` 恢复指引，exit 0。
- **不完整**：start/end 缺一或顺序错 → `missing or incomplete in AGENTS.md` 降级句 + 同上指引，exit 0。
- **追加段（三分支通用）**：`startup-reminder --codex` 退出 0 且 stdout 非空 → 空行分隔追加 `trim()` 输出；失败/超时(>1200ms)/空/路径不可信 → 静默跳过，exit 0。

> **正文不复制进计划/模板**：bootstrap 正文是 `instruction-bootstrap.js` 的派生产物，复制即制造会 drift 的第二副本。**R6 落地后**正文里的手动 startup-reminder 行会消失——这是 R6 与 hook 必须解耦的根因（hook 自动跑 reminder 后该行才冗余），由 source 函数单点变更驱动，hook/模板无需同步改动。

**Test scenarios**：脚本行为测试在 U4 统一覆盖（模板本身无独立运行入口，经 adapter 渲染后测试）。
Test expectation: none -- 纯模板文件，行为经 U2 渲染后由 U4 验证。

---

### U2. codex adapter 实现 runtime-file 生命周期

**Goal**：填充 `codex.js` 的 hook 写入/校验/删除，接通 init/clean/doctor 全链路。

**Requirements**：R1, R2, R3, R4, R5

**Dependencies**：U1

**Files**：
- `src/cli/adapters/codex.js`（修改：新增 hook 路径常量 + 实现/扩展 4 方法）
- `src/cli/commands/init.js`（小改：`printInitApplySuccess` 增加 codex hook 成功提示，UX 对称 claude 的 `🪝` 行）

**Approach**：
- 在 `codex.js` 顶部新增常量（对称 claude.js）：
  - `SESSION_START_TEMPLATE_PATH` → `templates/codex/hooks/session-start`
  - `HOOKS_JSON_TEMPLATE_PATH` → `templates/codex/hooks/hooks.json`
  - `SESSION_START_RELATIVE_PATH` → `.codex/hooks/session-start`
  - `HOOKS_JSON_RELATIVE_PATH` → `.codex/hooks/hooks.json`
  - 复用 claude 的 `__SPEC_FIRST_CLI_PATH__` placeholder 替换 + `TRUSTED_SPEC_FIRST_CLI_PATH` 注入模式
- `planRuntimeFilesSync(projectRoot)`（**追加签名参数 + 追加 ops**）：当前签名无 `projectRoot`，需补；返回 `[...buildRuntimeCleanupOperations(this), ...hookWriteOps]`——保留现有 6 条 legacy `remove_dir`，**追加** 两条 hook 写入 op（session-start 脚本 mode 0o755 + hooks.json）。kind 按文件存在与否取 `write_file`/`update_file`，contents 由模板渲染：
  - session-start 脚本：替换 `__SPEC_FIRST_CLI_PATH__` 为 `TRUSTED_SPEC_FIRST_CLI_PATH`
  - hooks.json：command 字段渲染为 `path.join(projectRoot, '.codex/hooks/session-start')` 绝对路径
- `planRuntimeFilesRemoval()`（**追加 ops**）：返回 `[...legacyCleanup, ...hookRemoveOps]`——保留现有 legacy `remove_dir`，追加两条 `remove_file`（session-start + hooks.json）。
- `inspectRuntimeFiles(projectRoot)`：对两文件做存在性 + 内容 drift 检查（对称 claude 的 `inspectSessionStartHook`），返回 PASS/WARNING 数组，fix 指向 `spec-first init`。drift 比对用同款渲染函数产出期望值——因 command 是 `projectRoot` 派生的绝对路径，期望值同样基于当前 `projectRoot` 渲染，故同机 init 后比对一致，不会因安装路径不同误报。
- `removeRuntimeFiles(projectRoot)`：在现有 legacy 目录清理基础上，**追加**删除两 hook 文件并清理空 `.codex/hooks/` 父目录（复用现有 `removeEmptyParents`）。
- init 成功提示：`printInitApplySuccess` 现有 `if (plan.platform === 'claude')` 旁增 `else if (plan.platform === 'codex')` 分支，输出 `🪝 Installed Codex SessionStart hook in .codex/hooks/`。注意语义差异：claude 那行指 settings.json matcher，codex 这行指 `planRuntimeFilesSync` 写入的 hook 文件（codex 无 settings.json）。

**Patterns to follow**：`claude.js` 的 `planRuntimeFilesSync`/`planRuntimeFilesRemoval`/`inspectRuntimeFiles`/`removeRuntimeFiles` + `renderSessionStartHookTemplate`/`inspectSessionStartHook` 整套结构；`codex.js` 现有 `buildRuntimeCleanupOperations` 的 legacy ops 保留模式。

**Test scenarios**（U4 实现，列此供 trace）：
- Covers AC1. `planRuntimeFilesSync` 在两文件缺失时产出 legacy ops + 2 条 hook write_file op，session-start mode=0o755。
- **回归守护**：`planRuntimeFilesSync`/`planRuntimeFilesRemoval` 仍含原有 6 条 legacy `remove_dir` op（追加非替换）。
- Covers AC6. 两文件已存在且内容一致时为 update_file（幂等，无重复条目）。
- `inspectRuntimeFiles`：缺失→WARNING；存在且一致→PASS；内容漂移→WARNING。
- Covers AC5. `planRuntimeFilesRemoval` 含 legacy ops + 2 条 hook remove_file op。
- 渲染产物：脚本含 `hookSpecificOutput`/`SessionStart` 且无残留 placeholder；hooks.json 为嵌套形态含 `session_start` 与绝对路径 command。

**Verification**：`spec-first init --codex` 后 `.codex/hooks/session-start`(0755) 与 `hooks.json`(嵌套形态) 存在且内容匹配渲染产物；`doctor --codex` 报 PASS；`clean --codex` 后 `.codex/hooks/` 不存在且 legacy 清理仍生效。

---

### U3. 收敛 Codex bootstrap block 的手动 reminder 行（R6，**hook 验证后解耦执行**）

**Goal**：移除 `codexStartupReminderLines` 第一行（指示 LLM 手动运行 `startup-reminder --codex`），使其与 hook 自动运行不重复；保留第二行（doc-review dispatch 授权）。

**Requirements**：R6

**Dependencies**：U1, U2，**且 hook 触发已 live 验证**（见下方 gate）

**执行顺序 gate（关键，来自评审 P1-C）**：
本 Unit **不与 hook 同步发布**。手动 reminder 行是当前 Codex 端**唯一**触发 `startup-reminder --codex` 的指令（`instruction-bootstrap.js:142`）。若在 hook 实际触发未经验证前就删除它，最坏情况是 hook 因平台差异静默不跑（见 P2-B/限制），Codex 端 startup-reminder 从「best-effort 手动」净退化为「完全不跑」。

因此：
- **先决条件**：U1/U2 落地后，在真实 Codex 会话验证 hook 确实触发并自动运行了 startup-reminder（见 Verification Plan 的 live caveat）。
- 验证通过前：**保留**手动 reminder 行，接受短期「hook + 手动」双跑（startup-reminder 幂等、best-effort，双跑无害）。
- 验证通过后：执行本 Unit 删行。
- 若 hook 触发无法验证（无 Codex live 环境）：本 Unit **暂缓**，手动 reminder 行保留，在计划/CHANGELOG 标注「待 hook 触发验证后再收敛」。

**Files**：
- `src/cli/instruction-bootstrap.js`（修改 `buildZhBootstrapBody`/`buildEnBootstrapBody`）

**Approach**：
- 在 `buildZhBootstrapBody` 与 `buildEnBootstrapBody` 的 `codexStartupReminderLines` 数组中，删除第一行（startup-reminder 手动运行指令），保留第二行（`$spec-doc-review` dispatch 授权）。
- 数组缩为单行后，确认 `codexStartupReminderLines ? ... : ''` 的拼接与换行仍正确（单行不再 `.join('\n')` 多行）。
- **drift 基线自洽**：`inspectInstructionBootstrap` 用 `buildBootstrapBlock(adapter,'zh'|'en')` 作期望值——同源函数，自动跟随，无需单独改。
- **历史 body 兼容——先验证再决定是否追加（来自评审 P3-A）**：在追加 legacy body 常量前，先写一个测试确认现有 `stripManagedBootstrapSections`（按 `## Workflow 入口治理` 标题 + bullet≥4 + managed anchor≥2 识别整段，**不依赖 body 精确匹配**）是否已能识别并替换含旧手动 reminder 行的 AGENTS.md：
  - **若已覆盖**（大概率，因旧 body 标题/bullet/anchor 均满足条件）：**不追加** legacy 常量，避免引入需永久维护的历史字符串（符合 CLAUDE.md「简洁优先」）。仅靠 AC8 测试守护。
  - **若未覆盖**（依赖 body 精确匹配）：在 `buildKnownBootstrapBodies` 追加旧版 Codex body 字符串，且须覆盖**全部历史变体**而非单一形态。旧 body 字面量须用 `git show HEAD:src/cli/instruction-bootstrap.js` 提取删行前的 `buildZhBootstrapBody('codex')`/`buildEnBootstrapBody('codex')` 实际输出，不靠人工拼凑。

**Patterns to follow**：现有 `stripManagedBootstrapSections` 的 section-level 容错清理；仅当确认不足时才用 `buildKnownBootstrapBodies` 的显式枚举模式。

**Test scenarios**（U4）：
- Covers AC7. `init --codex` 后 AGENTS.md bootstrap 不含「best-effort 运行 spec-first startup-reminder --codex」行，仍含「$spec-doc-review 默认多 persona dispatch」行。
- Covers AC7. `inspectInstructionBootstrap` 对新 body 返回 installed（不报 drift）。
- Covers AC8. 给定含手动 reminder 行的旧 AGENTS.md，`applyManagedBootstrapBlock`/`removeManagedBootstrapBlock` 能正确识别并替换/清除旧 block（不残留）——先验证 section-strip 是否已满足，再决定是否需要 legacy 常量。
- zh 与 en 两种语言均覆盖。

**Verification**：新写入 AGENTS.md 内容符合预期；旧形态 body 仍可被 strip/replace；doctor 不误报 drift。

---

### U4. 测试覆盖

**Goal**：覆盖 AC1-9，防回归。

**Requirements**：AC1-9

**Dependencies**：U1, U2；U3 仅在 live gate 通过时纳入本轮验证，否则作为 follow-up 验证。

**Files**：
- `tests/unit/codex-session-start-hook.test.js`（新增：adapter 生命周期 + 渲染产物契约 + 幂等）
- `tests/unit/instruction-bootstrap.test.js`（扩展：R6 收敛 + 旧 body 兼容）
- `tests/unit/runtime-hook-permissions.test.js`（扩展：codex session-start mode 0o755）
- `tests/smoke/release-dual-host-governance.sh`（按需扩展：init --codex 写入 hook、clean --codex 清除）

**Approach**：以 adapter 单测为主（读当前磁盘 source，不受会话缓存影响）。模板渲染产物先做字符串断言（含 `hookSpecificOutput`/`SessionStart`/降级分支），再必须在临时项目中执行渲染后的 `session-start` 脚本并 `JSON.parse(stdout)`，分别覆盖 bootstrap block 存在与缺失路径，断言 exit 0 与 `additionalContext` 内容。

**Test scenarios**：
- Covers AC1. init plan 含 codex hook 写入 ops，脚本 mode 0o755。
- Covers AC2/AC3. 执行渲染后的脚本，按「注入内容契约」三分支断言：(分支1) bootstrap 存在→合法 JSON，`additionalContext` 含三行引导 + 完整 block；(分支2) marker 全缺→「missing from AGENTS.md」降级文案，exit 0；(分支3) marker 不完整→「missing or incomplete」降级文案，exit 0。三分支 `hookEventName` 均为 `SessionStart`。
- startup-reminder 追加段：mock CLI 返回非空→以空行分隔追加；mock 失败/超时/空输出/路径不可信→静默跳过且不影响前段 `additionalContext`，exit 0。
- Covers AC4. `inspectRuntimeFiles` 缺失/存在/漂移三态。
- Covers AC5. clean plan 含 legacy ops + 2 条 hook remove_file。
- Covers AC6. 重复 init 幂等（update_file，无重复）。
- Covers AC7/AC8. 若 U3 live gate 通过，则覆盖 bootstrap 收敛 + 旧 body 兼容；若 U3 deferred，则记录 AC7/AC8 deferred。
- Covers AC9. 现有 Claude 链路测试全绿（运行既有 suite）。

**Verification**：`npm run test:unit` 与 `npm run test:smoke` 通过；新增断言覆盖上述场景。

---

## System-Wide Impact

- **双宿主对齐（startup 维度）**：Codex 获得与 Claude 在 startup 维度对齐的 hook 注入；`AGENTS.md`/`CLAUDE.md` 静态 block 继续作为 fallback。
  - **parity gap（诚实标注）**：compact 维度不对称——Claude session-start matcher 含 `compact` 会重注入；Codex 的 `pre_compact`/`post_compact` 为 `StatelessHookOutcome`，平台层不消费 context，无法重注入。这不是本计划放弃，是平台限制。compact 后 Codex 仍只能靠 AGENTS.md 被动重载。
  - **startup hook 相对 AGENTS.md 被动读取的边际价值**：AGENTS.md 在 startup 本就被动读取，hook 的增量价值在于——(1) 提供确定性、结构化的 `additionalContext` 注入点（不依赖宿主是否真的读了 AGENTS.md）；(2) 自动运行 startup-reminder（版本检查），替代 LLM best-effort 手动运行；(3) 建立 dual-host 注入基础设施，为未来 Codex 平台支持 compact context 时留接口。
- **init/clean/doctor**：核心逻辑零改动（仅 `printInitApplySuccess` 加一行 codex 提示）；codex adapter 的 `planRuntimeFilesSync`/`planRuntimeFilesRemoval` 在保留 legacy 清理 ops 基础上追加 hook ops，`inspectRuntimeFiles` 从空变有。
- **CHANGELOG**：需新增条目（user-visible：`spec-first init --codex` 现在安装 SessionStart hook）。若 R6 暂缓，标注「手动 reminder 行待 hook 触发验证后收敛」。
- **文档**：`docs/solutions/tooling-decisions/codex-cli-supports-lifecycle-hooks-2026-05-26.md` 可补「session_start 已落地、compact 为 StatelessHookOutcome 不可注入」回链；README 双宿主说明如提及 Claude hook 独有，需同步为「startup 对齐、compact 仍 Claude 独有」。

---

## Risks & Mitigation

| 风险 | 缓解 |
|---|---|
| **hooks.json schema 形态错误致 hook 静默不注册** | 已 confirmed-source 核对为**嵌套**形态（内层 `hooks` 数组）；U1 模板按嵌套写；U4 断言 hooks.json 结构 |
| **照「填充空方法」字面实现替换掉 legacy 清理 ops** | U2 明确 **追加非替换**（`[...legacyCleanup, ...hookOps]`）；U4 回归断言 legacy `remove_dir` 仍在 |
| **hook 触发未验证就删手动 reminder → startup-reminder 净退化为不跑** | R6（U3）与 hook 解耦，live gate 通过后才删；验证前保留手动行，接受幂等双跑 |
| Codex hook 输出格式与假设不符 | 已 confirmed-source 核对；脚本用合法 JSON + 自动化脚本执行测试守护；若 live Codex 注入不通过，不执行 U3/R6，继续保留 AGENTS.md 静态 bootstrap fallback |
| 无效类 JSON stdout 导致 hook fail | 沿用 `JSON.stringify`，绝不手拼 JSON；降级分支也走 stringify |
| R6 删行破坏旧 AGENTS.md 清理 | U3 先用 AC8 验证现有 section-level strip 是否已覆盖旧 body；仅在不足时追加 legacy body 常量（覆盖全部变体，`git show` 提取真实旧值） |
| startup-reminder 调用阻塞会话 | best-effort + timeout，失败忽略（对称 claude，NFR1 < 1200ms） |
| Codex 环境变量名（CODEX_PROJECT_DIR）未确认 + hook 真实 cwd 未知 | 脚本 `CODEX_PROJECT_DIR:-$(pwd)` 兜底；hooks.json command 固定渲染为绝对路径，不依赖 Codex 展开 `$CODEX_PROJECT_DIR`；smoke 须在「非项目根 cwd 且不设 CODEX_PROJECT_DIR」条件下执行脚本才算真正测到兜底 |
| AGENTS.md 被改后 hook 注入被污染（prompt injection） | trusted-by-design：仓库写权限即信任边界，AGENTS.md 与 hook 脚本同源；`JSON.stringify` 转义封堵控制字段伪造（见 U1 信任边界声明） |

---

## Assumptions

- `[confirmed]` Codex hook 输出消费 `hookSpecificOutput.additionalContext`，配置 key `session_start`，输出 event name `SessionStart`（source: `session_start.rs`）。
- `[confirmed]` hooks.json 为**嵌套**形态（`event_key -> [{ hooks: [{type,command}] }]`），command 用绝对路径（source: tooling-decisions 文档 + `lib.rs`）。
- `[confirmed]` Codex `pre_compact`/`post_compact` 为 `StatelessHookOutcome`，源码无 `additional_context` 字段——compact 后 context 重注入平台层不可行（source: `compact.rs`）。这是平台限制，非主动 Non-Goal。
- `[advisory]` Codex 在 startup 触发 session_start（与 Claude startup 等价）；**触发时机与 `additionalContext` 实际注入未做 live 验证**——R6 解耦 gate 的依据。
- `[advisory]` `CODEX_PROJECT_DIR`、hook 执行 cwd 未确认；脚本用 `pwd` 兜底 + command 绝对路径，脚本执行测试覆盖兜底行为。

---

## Scope Boundaries

### 本计划范围
- 新增 Codex hook 模板与 adapter 生命周期实现
- doctor/clean 经既有接入点自动接通
- Codex bootstrap block R6 收敛 + 历史兼容（仅在 live gate 通过时纳入本轮；否则 deferred）
- 测试与 CHANGELOG

### Deferred to Follow-Up Work
- Cursor / Copilot CLI 等新平台 adapter 与 hook（origin Non-Goal）
- Codex compact 事件重注入（当前平台 outcome 不消费 `additionalContext`，origin Non-Goal）
- 若本轮无法完成真实 Codex SessionStart live 验证，则 deferred U3/R6 bootstrap 手动 reminder 收敛

### Outside this product's identity
- 修改 Claude adapter / claude-settings.js / Claude session-start 模板（已完整）
- 消除「静态 block + hook 动态注入」双重注入（对抗 compact 的有意设计）

---

## Deferred Implementation Notes

- `hooks.json` 中 `command` 固定渲染为绝对路径；若未来要改用 `$CODEX_PROJECT_DIR` 或相对路径，需另起 follow-up 并先以 Codex source/live 验证 command 展开行为。
- session-start 脚本是否需要 `command_windows` 字段（Codex 原生跨平台）——本计划先做 bash 版，Windows parity 留作后续（如 CHANGELOG/issue 跟踪）。

---

## Verification Plan

- `npm run typecheck`
- `npm run test:unit`（含新增 `codex-session-start-hook.test.js` + 扩展的 bootstrap/permissions 测试）
- `npm run test:smoke`（dual-host governance）
- **legacy 回归断言**：codex `planRuntimeFilesSync`/`planRuntimeFilesRemoval` 在追加 hook ops 后仍含原有 6 条 legacy `remove_dir` op（防替换回归）
- 手动：临时项目 `spec-first init --codex` → 查 `.codex/hooks/` 两文件（hooks.json 为嵌套形态、command 绝对路径）→ **在非项目根 cwd 且不设 `CODEX_PROJECT_DIR`** 执行 session-start 脚本断言 JSON（真正测到 `pwd` 兜底）→ `doctor --codex` PASS → `clean --codex` 清空且 legacy 清理仍生效
- U3/R6 gate：真实 Codex 会话触发 SessionStart hook 并确认 `additionalContext` 注入后，才删除 AGENTS.md 手动 `startup-reminder --codex` 行；直接执行脚本只证明脚本行为，不满足 live gate
- AC9：既有 Claude 链路测试全绿（无回归）

---

## Completion Notes

- Completed: U1/U2/U4。`spec-first init --codex` now installs `.codex/hooks/session-start` and `.codex/hooks/hooks.json`; `doctor --codex` inspects both files; `clean --codex` removes both files while preserving legacy cleanup ops.
- Deferred by plan gate: U3/R6 bootstrap reminder removal. No real Codex live SessionStart trigger evidence was available in this work run, so the AGENTS.md manual `startup-reminder --codex` fallback remains intentionally present.
- Documentation aligned: `docs/solutions/tooling-decisions/codex-cli-supports-lifecycle-hooks-2026-05-26.md` now records that Codex compact hooks are `StatelessHookOutcome` and cannot inject `additionalContext`.
- Verification completed: `npm run typecheck`; `npm run test:unit`; `npm run test:smoke`; `bash tests/smoke/release-dual-host-governance.sh`; manual temp-project `init --codex` / hook JSON execution / `doctor --codex` / `clean --codex`.
