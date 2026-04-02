---
title: "feat: spec-bootstrap MCP-first 改造实现"
type: feat
status: active
date: 2026-04-02
origin: docs/brainstorms/2026-04-02-spec-bootstrap-mcp-first-requirements.md
---

# feat: spec-bootstrap MCP-first 改造实现

## Overview

将 `spec-bootstrap` 的"环境准备"职责前移至 `mcp-setup`，形成清晰主链：`/spec:mcp-setup` → 重启 Claude Code → `/spec:bootstrap`。

改造包含三个核心部分：
1. 新增 `verify-tools.sh` 脚本：在 `mcp-setup` 完成安装后写入宿主状态 marker 文件
2. 改造 `mcp-setup/SKILL.md`：新增 Host Verification 阶段，标准化输出下一步指引
3. 改造 `spec-bootstrap/SKILL.md`：新增前置门（宿主状态机检测）+ 重写 Phase 1.3 Mode Detection 为真实 project-level readiness probe

（设计细节见：`docs/plans/2026-04-02-spec-bootstrap-mcp-first-design.md`）

## Problem Frame

`spec-bootstrap` 当前 Phase 1 把"工具安装态"近似当成"当前项目可用"，且缺少宿主级前置检查，导致：
- 用户在未执行 `mcp-setup` 的宿主上运行 bootstrap，会进入错误的模式判断
- `mcp-setup` 完成但未重启时，MCP 工具不可用，bootstrap 仍可能继续推进
- ABCoder 的 parse 在 bootstrap 内被触发但缺少受控的超时与路径验证

（见 origin: R1–R10）

## Requirements Trace

- **R1-R3** → Unit 3: 前置门检查；宿主未就绪时强制阻断，不降级到 Basic
- **R4** → Unit 3: spec-bootstrap 不再承担"补装工具"职责
- **R5** → Unit 3: SETUP_DONE_NOT_RESTARTED 状态检测，要求重启
- **R6** → Unit 2: mcp-setup 明确输出"重启后执行 /spec:bootstrap"
- **R7** → Unit 1+2: verify-tools.sh 只做宿主级安装态验证，不做项目级 probe
- **R8** → Unit 1: 以 `host-setup.json` 存在作为宿主验证凭据
- **R9** → Unit 4: 模式选择基于真实 probe 结果（ready），不基于安装态
- **R10** → Unit 4: 项目级 probe 失败驱动降级，不触发前置门阻断
- **R11-R12** → Unit 3+4: 阻断提示包含三要素（原因/行动/下一步），不暴露底层异常

## Scope Boundaries

- **不包含**：spec-bootstrap Phase 2/3 的产物结构、worker 划分、backup/restore 策略
- **不包含**：Codex 平台适配（R14，另行规划）
- **不包含**：对 `src/cli/` 的改动（SKILL.md 改造不触及 adapter 逻辑）
- **包含（AF-002 修复）**：ABCoder MCP server 配置写入 `~/.claude.json`（由 Unit 2 新增步骤完成；当前 `mcp-tools.json` 中 `abcoder.mcp_config = null`，导致 `install-coordinator.sh` 不写入 ABCoder 配置，若不修复则 Full 模式永久不可达）

## Context & Research

### Relevant Code and Patterns

- `skills/mcp-setup/scripts/detect-tools.sh`：mcp_config 检测模式（`jq -e '.mcpServers[$t]'`），verify-tools.sh 可沿用
- `skills/mcp-setup/scripts/install-coordinator.sh`：原子写模式（`mktemp + chmod 600 + mv`），verify-tools.sh 写 host-setup.json 时使用相同模式
- `tests/unit/mcp-setup.sh`：`FAKE_HOME` 隔离模式，`assert_contains` / `assert_output` 断言风格
- `skills/spec-bootstrap/SKILL.md:123-137`：现有 Analysis Mode Detection 表（将被替换为 project-level probe 描述）
- `skills/spec-bootstrap/SKILL.md:169-197`：现有 Mode Detection 输出块 + ABCoder auto-configuration 块（将被重写）
- `skills/mcp-setup/SKILL.md:167-184`：现有 Verification 章节（将被更新为新输出格式 + Phase 4 入口）

### Institutional Learnings

- **Bash 3.2 可移植性** (`docs/solutions/developer-experience/bash-portability-pitfalls-2026-04-01.md`)：
  - 禁止 `mapfile`，用 `while IFS= read -r` 替代
  - 空数组展开需 `${arr[@]+"${arr[@]}"}`
  - jq 含连字符的 key 用 `--arg + [$t]`
  - 原子写：`mktemp` → `chmod 600` → `mv`（mv 不保留权限，chmod 必须在 mv 之前）
  - `flock` macOS 不自带，用 `mkdir` 原子锁替代
- **MySQL hostname 教训** (`docs/solutions/logic-errors/mcp-mysql-hostname-validation-logic-flaw-2026-04-01.md`)：验证逻辑实体（project path 比对）而非基础设施拓扑

### External References

无（本地模式覆盖完整）

## Key Technical Decisions

- **verify-tools.sh 只做安装态验证**：不启动 MCP server，不做 MCP tool call；MCP server 可达性由 spec-bootstrap 运行时 probe（见设计 §1.2 rationale）
- **重启检测靠 MCP 可调用性**：`context7.resolve-library-id` 或 `serena.get_current_config` 作为探针；调用成功即证明 MCP 配置已加载（见设计 §1.3）
- **ABCoder probe 触发 parse（Option A）**：`list_repos()` 为空时触发 parse（60s 外层计时器），不依赖 ABCoder 内部超时；确保 Full 模式在首次运行可达（见设计 §2.2）
- **all-settled 并行 probe**：三工具独立捕获结果，不互相取消（见设计 §2.5）
- **Serena activate 后验证路径**：防止激活了错误项目（见设计 §2.2 P1 修复）
- **GitNexus 不触发索引**：未索引即判 `ready=false`，区分 `repo-not-indexed` vs `gitnexus-mcp-error`

## Open Questions

### Resolved During Planning

- **verify-tools.sh 写入哪里**：`~/.claude/spec-first/host-setup.json`（需 `mkdir -p`）（见设计 §1.3）
- **重启探针选哪个**：优先 `context7.resolve-library-id`，备选 `serena.get_current_config`（无副作用，调用开销小）
- **ABCoder parse 超时如何计时**：probe 外层记录开始时间戳，每次轮询检查是否超过 60s（不依赖 ABCoder 内部机制）
- **spec-bootstrap front gate 插入点**：在现有 `## Analysis Mode Detection`（第 123 行）**之前**新增 `## Host Readiness Gate` 章节（pre-Phase 1）

### Deferred to Implementation

- **host-setup.json schema 版本演进**：当前 `"version": "1"`，未来字段扩展时的向后兼容策略
- **ABCoder parse 轮询间隔**：实现时确定（建议 5s 轮询），不在计划中预设
- **Serena path 比对细节**：大小写、尾部斜杠的归一化方式（实现时确认 Serena 返回格式）

## High-Level Technical Design

> *此图为方向性设计指导，供审查验证思路，不作为实现规格。*

### 宿主状态机（前置门）

```
用户运行 /spec:bootstrap
         │
         ▼
[Step 1] host-setup.json 存在?
   └─ No  → 状态: NOT_SETUP
            输出: "请先运行 /spec:mcp-setup"
            立即停止 ■
   └─ Yes  ▼
[Step 2] MCP ping probe (timeout: 10s)
   └─ 失败/超时 → 状态: SETUP_DONE_NOT_RESTARTED
                  输出: "请重启 Claude Code"
                  立即停止 ■
   └─ 成功 → 状态: READY
              继续项目级 probe ▼

[all-settled 并行 probe]
  ┌── Serena: activate → path verify → probe
  ├── GitNexus: query index
  └── ABCoder: list_repos → [preflight → parse (≤60s)] → verify

[模式选择]
  GitNexus.ready AND ABCoder.ready    → Full
  Serena.ready OR ABCoder.ready       → Enhanced
  else                                → Basic
```

### verify-tools.sh 输出契约

```json
{
  "version": "1",
  "completed_at": "<ISO 8601>",
  "setup_success": true,
  "tools": {
    "abcoder":  { "installed": true|false, "binary_ok": true|false },
    "gitnexus": { "configured": true|false },
    "serena":   { "configured": true|false },
    "context7": { "configured": true|false }
  },
  "java_runtime": { "present": true|false, "reason": "java-not-found|ok" }
}
```

## Implementation Units

---

- [ ] **Unit 1: 新增 `skills/mcp-setup/scripts/verify-tools.sh`**

**Goal:** 在 mcp-setup 安装完成后，验证各工具的宿主级安装态/配置态，并将结果写入 `~/.claude/spec-first/host-setup.json`

**Requirements:** R7, R8

**Dependencies:** 无（可独立实现）

**Files:**
- Create: `skills/mcp-setup/scripts/verify-tools.sh`
- Update: `CHANGELOG.md`

**Approach:**
- 使用 `set -euo pipefail`，延续现有脚本风格
- 路径使用 `cd "$(dirname "$0")" && pwd` 模式
- `abcoder`：`command -v abcoder >/dev/null 2>&1` + `abcoder version >/dev/null 2>&1`
- `serena`/`gitnexus`/`context7`：`jq -e --arg t "$tool" '.mcpServers[$t]' "$CLAUDE_JSON"` 检查 `~/.claude.json`
- `java`（可选，用于 ABCoder preflight 参考）：`command -v java >/dev/null 2>&1`
- 目标文件路径：`"${HOME}/.claude/spec-first/host-setup.json"`，需 `mkdir -p` 创建父目录
- **原子写**：`mktemp` → `chmod 600` → `jq -n` 构建 JSON（含 `"setup_success": true`）→ `mv`（chmod 必须在 mv 之前）
- **setup_success 字段**：verify-tools.sh 自身正常完成时写入 `setup_success: true`；Unit 2 在 verify-tools.sh 退出非零时应额外写入 `setup_success: false` 的降级文件（或不写入，让 spec-bootstrap Step 1 无文件即判 NOT_SETUP）；见 Unit 2 说明
- **写入失败处理**：目录不可写时以非零 exit code 退出，输出明确错误信息；不得在未写入 marker 文件的情况下以 0 退出
- 幂等：重复运行覆盖写入，不报错
- `~/.claude.json` 不存在时，`configured=false`，不报错退出（工具未安装，这是合法状态）

**Patterns to follow:**
- `skills/mcp-setup/scripts/detect-tools.sh`：jq 检测 mcpServers 的完整模式
- `skills/mcp-setup/scripts/install-coordinator.sh`：原子写 + chmod 模式
- bash 3.2 兼容性约束（见 Institutional Learnings）

**Test scenarios:**
- Happy path: abcoder 二进制存在 + ~/.claude.json 含所有 mcpServers → `host-setup.json` 写入正确，所有字段 true
- Happy path: java 存在 → `java_runtime.present=true`
- Edge case: abcoder 二进制不存在 → `abcoder.installed=false, binary_ok=false`，脚本仍成功退出并写入文件
- Edge case: `~/.claude.json` 不存在 → `configured=false` for all MCP tools，脚本仍成功退出
- Edge case: mcpServers 存在但缺少某工具 key → 该工具 `configured=false`，其他工具正确
- Edge case: java 不存在 → `java_runtime.present=false, reason=java-not-found`
- Idempotency: 连续执行两次 → 第二次覆盖写入，内容正确，无报错
- Error path: `~/.claude/spec-first/` 目录不可写 → 非零 exit code，输出包含"无法写入"提示
- Atomic write: `host-setup.json` 写完后是合法 JSON（`jq . host-setup.json` 应成功）
- Permissions: `host-setup.json` 权限为 600

**Verification:**
- `bash skills/mcp-setup/scripts/verify-tools.sh` 在有效 FAKE_HOME 环境下以 exit 0 完成
- 输出 `host-setup.json` 通过 `jq .` 验证
- `tests/unit/mcp-setup.sh` 中新增测试组通过

---

- [ ] **Unit 2: 改造 `skills/mcp-setup/SKILL.md`**

**Goal:** 新增 Host Verification 阶段（调用 verify-tools.sh），更新完成输出为标准化的"重启 + /spec:bootstrap"提示

**Requirements:** R6, R7, R8

**Dependencies:** Unit 1（verify-tools.sh 需先定义）

**Files:**
- Modify: `skills/mcp-setup/SKILL.md`
- Update: `CHANGELOG.md`

**Approach:**

**(a) 新增 Phase 4: Host Verification**

精确插入点：在现有 `---`（当前第 165 行）之后、`## Verification`（当前第 167 行）之前；Phase 4 块结尾补一行 `---` 分隔。实现时先 `grep -n "## Verification" skills/mcp-setup/SKILL.md` 确认行号。

在 Phase 3（Optional Tools）之后、原 `## Verification` 章节之前，新增：

```
## Phase 4: Host Verification

Run `skills/mcp-setup/scripts/verify-tools.sh` to validate host-level install state
and write `~/.claude/spec-first/host-setup.json`.

If verify-tools.sh exits non-zero (e.g., cannot write marker file):
- Report the failure with the script's error output
- Do not claim setup is complete
```

**(b) 更新 `## Verification` 完成输出**

当前输出只说"Please restart Claude Code for changes to take effect."。
改为标准化三要素格式：

```
✅ MCP Tools Setup Complete

Host readiness:
- dependencies: ready
- mcp config: ready
- tool binaries: ready
- host marker: written (~/.claude/spec-first/host-setup.json)

Next steps:
1. Restart Claude Code (required to load new MCP configuration)
2. Run /spec:bootstrap
```

**(c) 更新 `## Scope Boundaries`**

在 Excludes 下新增一条：
- Runtime MCP server availability verification (handled by spec-bootstrap at project-level probe)

**(d) 补写 ABCoder MCP server 配置（AF-002）**

当前 `mcp-tools.json` 中 `abcoder.mcp_config = null`，`install-coordinator.sh` 会跳过写入 ABCoder MCP server 配置。若不修复，Unit 4 的 ABCoder probe 永远无法成功，Full 模式不可达。

在 Phase 4 或独立的配置补写步骤中，显式将 ABCoder MCP server 配置写入 `~/.claude.json`（使用 `jq` 原子写，与现有 install-coordinator.sh 写配置方式一致）：
- 若 `abcoder` 二进制存在 → 写入 ABCoder MCP server 条目到 `mcpServers`
- 若已存在 → 幂等跳过或覆盖（视现有 install-coordinator.sh 处理方式而定）

**Patterns to follow:**
- 现有 Phase 1-3 结构和标题风格
- `skills/mcp-setup/scripts/install-coordinator.sh` 中现有 MCP config 写入逻辑

**Test scenarios:**
- Smoke: `spec-first init --claude` 后，`.claude/skills/mcp-setup/SKILL.md` 包含 "Phase 4: Host Verification"（目标文件：`tests/smoke/cli.sh`）
- Smoke: `.claude/skills/mcp-setup/SKILL.md` 包含 "host-setup.json" 字符串（目标文件：`tests/smoke/cli.sh`）
- Smoke: `.claude/skills/mcp-setup/SKILL.md` 包含 "/spec:bootstrap" 字符串（目标文件：`tests/smoke/cli.sh`）

**Verification:**
- `.claude/skills/mcp-setup/SKILL.md` 与 `skills/mcp-setup/SKILL.md` 经 `spec-first init` 同步后内容一致
- `npm run test:smoke` 通过

---

- [ ] **Unit 3: `spec-bootstrap/SKILL.md` — 新增 Host Readiness Gate**

**Goal:** 在 Phase 1 之前新增 `## Host Readiness Gate` 章节，实现宿主状态机（NOT_SETUP / SETUP_DONE_NOT_RESTARTED / READY）检测，强制阻断宿主未就绪的情况

**Requirements:** R1, R2, R3, R4, R5, R11, R12

**Dependencies:** Unit 1（host-setup.json schema 已定义）

**Files:**
- Modify: `skills/spec-bootstrap/SKILL.md`
- Update: `CHANGELOG.md`

**Approach:**

精确插入点：在 `## Analysis Mode Detection` 之前（实现时先 `grep -n "## Analysis Mode Detection" skills/spec-bootstrap/SKILL.md` 确认行号）。

在 `## Analysis Mode Detection` **之前**插入新章节：

```markdown
## Host Readiness Gate

**Run this check before any other phase. If it fails, stop immediately.**

### Step 1: Check mcp-setup marker

Check whether `~/.claude/spec-first/host-setup.json` exists **and** `setup_success == true`.

- **文件不存在，或存在但 `setup_success != true`** → State: `NOT_SETUP`

  Output to user:
  ```
  ⛔ spec-bootstrap 无法继续：宿主尚未完成 MCP 工具安装。

  原因：未检测到 ~/.claude/spec-first/host-setup.json，
        说明 /spec:mcp-setup 尚未在本机成功执行。

  操作：请先运行 /spec:mcp-setup 并等待完成。

  完成后：重启 Claude Code，然后重新运行 /spec:bootstrap。
  ```

  Stop. Do not proceed to Step 2 or any Phase.

### Step 2: Check MCP runtime availability (timeout: 10s)

Attempt a lightweight, side-effect-free MCP tool call to confirm Claude Code has loaded
the current MCP configuration.

Preferred probe: `context7 resolve-library-id` with any query string.
Fallback probe: `serena get_current_config`.

- **Probe fails or times out (10s)** → State: `SETUP_DONE_NOT_RESTARTED`

  Output to user:
  ```
  ⛔ spec-bootstrap 无法继续：MCP 工具尚不可调用。

  原因：~/.claude/spec-first/host-setup.json 存在（mcp-setup 已完成），
        但 MCP 工具当前不可调用，通常说明 Claude Code 尚未重启以加载新配置。

  操作：请重启 Claude Code。

  完成后：重新运行 /spec:bootstrap。

  如果重启后仍看到此提示，请运行 `claude mcp list` 确认 MCP 服务已注册，
  或重新运行 /spec:mcp-setup。
  ```

  Stop. Do not proceed to Phase 1.

- **Probe succeeds** → State: `READY`. Continue to `## Analysis Mode Detection`.
```

**注意事项：**
- 阻断输出必须包含三要素：原因 / 操作 / 完成后下一步
- 两类阻断均不进入 Phase 1，不执行任何项目分析逻辑（见 R3）
- MCP probe 超时：若 tool call 失败或返回错误（包括 Claude Code 内置超时机制触发的超时），一律视为探针失败，判定 SETUP_DONE_NOT_RESTARTED 状态；不使用 LLM 计时器（LLM 无法可靠追踪时间或中断 tool call）

**Test scenarios:**
- Acceptance: `host-setup.json` 不存在 → 输出包含"/spec:mcp-setup"且停止，不输出 Phase 1 内容
- Acceptance: `host-setup.json` 存在但 MCP ping 超时 → 输出包含"重启 Claude Code"且停止
- Acceptance: `host-setup.json` 存在且 MCP ping 成功 → 继续进入 Phase 1（不阻断）
- Acceptance: 任何阻断路径均不进入 Basic 模式（验证：输出中无 "分析模式: Basic"）

**Verification:**
- `.claude/skills/spec-bootstrap/SKILL.md` 包含 "Host Readiness Gate" 章节
- `.claude/skills/spec-bootstrap/SKILL.md` 包含 "NOT_SETUP" 和 "SETUP_DONE_NOT_RESTARTED"

---

- [ ] **Unit 4: `spec-bootstrap/SKILL.md` — 重写 Analysis Mode Detection + Phase 1.3 probe**

**Goal:** 将现有 `## Analysis Mode Detection` 中的安装态检测表替换为真实的 project-level readiness probe 描述，将 Phase 1.3 的 Mode Detection 块替换为 all-settled 并行 probe + 新模式选择算法

**Requirements:** R9, R10, R11, R12

**Dependencies:** Unit 3（Host Gate 已插入，分区结构已确定）

**Files:**
- Modify: `skills/spec-bootstrap/SKILL.md`
- Update: `CHANGELOG.md`

**Precondition:** Unit 3 验证通过（`.claude/skills/spec-bootstrap/SKILL.md` 包含 "Host Readiness Gate" 章节），确认前置门已插入后再开始 Unit 4 改动。

**Approach:**

**(a) 替换 `## Analysis Mode Detection`（锚点：`grep -n "## Analysis Mode Detection"`）**

将静态检测表替换为 probe 结果驱动的模式定义：

```markdown
## Analysis Mode

Mode is determined after running Project Tool Readiness probes in Phase 1.3.

| Mode | Condition | Capability |
|------|-----------|------------|
| **Full** | `gitnexus.ready AND abcoder.ready` | Architecture-level + symbol-level analysis |
| **Enhanced** | `serena.ready` (GitNexus/ABCoder not required) | Semantic analysis; ABCoder used if also ready |
| **Basic** | All probes failed | Text-level analysis via Read/Grep/Glob |

Note: Mode is selected after probes complete. `ready` means the probe succeeded for the current project, not merely that the tool is installed or configured.

Basic mode: uses only Read/Grep/Glob. No MCP tools. Analysis depth is limited —
output will lack cross-file call chains, history semantics, and full type graphs.
User will be informed of the mode and its limitations.

Report format: `> [Bootstrap] Analysis mode: <mode> | DB access: <db-mode>`
```

**(b) 替换 Phase 1.3 Mode Detection 块（锚点：`grep -n "Mode Detection\|ABCoder auto-configuration"` 定位起止行）**

将安装态检测块 + ABCoder auto-configuration 块替换为真实 probe 描述：

```markdown
**Project Tool Readiness (run in parallel, all-settled — do not cancel on failure):**

Run all three probes concurrently. Collect each result independently.

**Serena probe:**
1. Call `serena get_current_config` or equivalent to check MCP availability
2. If no active project: call `serena activate_project` with current working directory
3. After activate: verify the returned active project path matches `$CWD`
   - Mismatch → `serena.ready=false`, `reason=serena-wrong-project-activated`
4. If path matches: call `serena get_symbols_overview` as lightweight probe
- Success → `serena.ready=true`
- Failure → `serena.ready=false`, record reason (`serena-activate-failed` / `serena-probe-failed`)

**GitNexus probe:**
1. Check MCP availability
2. Query current repo (e.g., `search_commits` or `get_file_history` with minimal args)
   - Results returned → `gitnexus.ready=true`
   - Empty result (repo not indexed) → `gitnexus.ready=false`, `reason=repo-not-indexed`
   - MCP exception / service unreachable → `gitnexus.ready=false`, `reason=gitnexus-mcp-error`
- Do not trigger indexing. Do not wait. Degrade immediately.

**ABCoder probe (4 steps):**

Step 1: `list_repos()` — always first, never guess repo_name from directory name
  - Repo found → skip to Step 4

Step 2 (if list_repos empty): Language preflight for Java projects
  - `java -version` accessible?
  - `JAVA_HOME` resolvable?
  - JDT cache directory writable?
  - (Optional) JDT download source network reachable?
  - Any failure → `abcoder.ready=false`, record reason (e.g., `java-runtime-missing`, `jdt-cache-not-writable`, `jdt-network-unreachable`)

Step 3: Trigger parse, wait ≤ 60s (outer timer — record start time, check elapsed on each poll)
  - Timeout → `abcoder.ready=false`, `reason=parse-timeout`; note: Java JDT cold-start may exceed 60s, inform user to retry in a better network environment
  - Parse failure → `abcoder.ready=false`, `reason=parse-failed`

Step 4: Verify
  - `list_repos()` again — confirm repo visible
  - Verify returned repo root path matches `$CWD` (to avoid wrong-repo false positive)
  - `get_repo_structure` with the retrieved repo_name
  - All pass → `abcoder.ready=true`
  - Any fail → `abcoder.ready=false`, `reason=repo-not-visible-in-abcoder` or `reason=abcoder-wrong-repo`

**Mode selection (after all probes complete):**

```
if gitnexus.ready AND abcoder.ready  → Full
elif serena.ready OR abcoder.ready   → Enhanced  (ABCoder used if also ready)
else                                 → Basic
```

**Report to user:**
```
🔍 检测项目工具就绪状态...

Serena:   ready=yes, project=<path>
GitNexus: ready=no,  reason=repo-not-indexed
ABCoder:  ready=yes

📊 分析模式: Enhanced  (ABCoder 可用)
```

Then proceed with analysis using the selected mode's tool set.
```

**注意事项：**
- ABCoder auto-configuration 块（R17-R20，原第 183-196 行）**完全移除**：MCP 配置已由 mcp-setup 写入，不再在 bootstrap 内临时写入
- `## Analysis Mode Detection` 第一行的静态模式表也同步替换

**Test scenarios:**
- Acceptance: 所有 probe 成功（GitNexus + ABCoder）→ 模式输出 "Full"
- Acceptance: 仅 Serena.ready=true → 模式输出 "Enhanced"
- Acceptance: 仅 ABCoder.ready=true（Serena=false, GitNexus=false）→ 模式输出 "Enhanced"（ABCoder 可用，不应降级为 Basic）
- Acceptance: Serena.ready=true + ABCoder.ready=true + GitNexus.ready=false → 模式输出 "Enhanced"，报告 ABCoder 可用
- Acceptance: 全部 probe 失败 → 模式输出 "Basic"，描述分析局限性
- Acceptance: ABCoder list_repos() 空 → 触发 parse，不立即降级
- Acceptance: ABCoder parse 超时 → reason=parse-timeout，降级到 Enhanced 或 Basic
- Smoke: `.claude/skills/spec-bootstrap/SKILL.md` 不含 "ABCoder auto-configuration" 字符串（已移除）
- Smoke: `.claude/skills/spec-bootstrap/SKILL.md` 不含 "abcoder parse <language>" 字符串（已移除）

**Verification:**
- `.claude/skills/spec-bootstrap/SKILL.md` 包含 "Project Tool Readiness" 和 "all-settled"
- `.claude/skills/spec-bootstrap/SKILL.md` 不含 "ABCoder auto-configuration"
- `npm run test:smoke` 通过

---

- [ ] **Unit 5: `tests/unit/mcp-setup.sh` — verify-tools.sh 测试组**

**Goal:** 为 verify-tools.sh 新增完整的单元测试组，覆盖 JSON 输出、工具检测准确性、写入行为、权限和幂等性

**Requirements:** R7, R8（可测性验证）

**Dependencies:** Unit 1（verify-tools.sh 实现完成）

**Files:**
- Modify: `tests/unit/mcp-setup.sh`
- Update: `CHANGELOG.md`

**Approach:**

在现有测试尾部追加新测试组，延续现有测试风格（`FAKE_HOME` 隔离 + `assert_contains` / `assert_output` 断言）：

```
9. verify-tools.sh
  9.1 abcoder binary detected when present
  9.2 abcoder binary not detected when absent (PATH override)
  9.3 serena configured=true when mcpServers.serena exists in ~/.claude.json
  9.4 serena configured=false when ~/.claude.json absent
  9.5 serena configured=false when mcpServers key exists but serena missing
  9.6 host-setup.json written to correct path
  9.7 host-setup.json is valid JSON after write
  9.8 host-setup.json has chmod 600 permissions
  9.9 idempotent: second run overwrites, no error
  9.10 exits non-zero when host-setup.json parent not writable
  9.11 java_runtime.present=false when java not in PATH
  9.12 context7 configured=true when mcpServers.context7 exists in ~/.claude.json
```

测试隔离：
- 每个测试用 `FAKE_HOME=$(mktemp -d)` + `trap 'rm -rf "$FAKE_HOME"'`
- `HOME="$FAKE_HOME"` 覆盖，使 `~/.claude/spec-first/host-setup.json` 写入 FAKE_HOME

**Patterns to follow:**
- `tests/unit/mcp-setup.sh` 现有测试分组和断言函数
- `FAKE_HOME` 隔离模式

**Test scenarios:** （即测试列表 9.1-9.12，见上）

**Verification:**
- `bash tests/unit/mcp-setup.sh` 全部通过（零失败）

---

## System-Wide Impact

- **init 同步**：`src/cli/commands/init.js` 通过 `syncBundledAssets` 将 `skills/` 复制到 `.claude/skills/`；verify-tools.sh 和两个 SKILL.md 的改动会在用户执行 `spec-first init` 后自动同步，无需修改 adapter 或 plugin.json
- **运行时文件**：`~/.claude/spec-first/host-setup.json` 是新增的运行时产出文件，不在项目目录下，不被 `.gitignore` 影响，不影响 `spec-first doctor` 当前检查项
- **ABCoder auto-configuration 移除影响**：现有用户若依赖 spec-bootstrap 自动写入 ABCoder MCP 配置，需先运行 `spec-first init --claude` 同步新版 SKILL.md，再运行 `/spec:mcp-setup` 完成配置。不会静默破坏；bootstrap 会在前置门处给出明确提示。
- **Unchanged invariants**：Phase 2（PRD 生成）、Phase 3（worker dispatch）、产物目录结构（`docs/contexts/<slug>/`）、backup/restore 逻辑均不变

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| ABCoder 60s 超时在 JDT 冷启动场景中不足 | 设计上接受此降级，用户提示说明原因并建议重试；60s 上限是合理等待上限，不延长 |
| Serena `activate_project` 返回格式未知（无法验证路径） | 实现时确认 Serena MCP 返回字段；若无法获取路径，跳过路径校验并记录 `reason=serena-path-unknown` |
| Unit 3/4 改动量大，SKILL.md 内容结构可能有行偏移 | 实现时先 `grep -n` 定位精确行号，再用 Edit tool 做精确替换 |
| verify-tools.sh bash 3.2 兼容性 | 遵循 Institutional Learnings 中的可移植性约束，PR 前在 macOS 默认 bash 3.2 环境测试 |
