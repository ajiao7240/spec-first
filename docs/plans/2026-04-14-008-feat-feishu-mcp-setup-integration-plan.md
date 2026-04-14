---
title: "feat: 集成飞书 MCP 到 spec-mcp-setup"
type: feat
status: active
date: 2026-04-14
origin: docs/brainstorms/2026-04-14-feishu-mcp-setup-integration-requirements.md
---

# feat: 集成飞书 MCP 到 spec-mcp-setup

## Overview

在 `spec-mcp-setup` skill 中为飞书官方 MCP（`@larksuiteoapi/lark-mcp`）添加完整的检测、安装引导和验证支持。核心挑战是飞书 MCP 使用用户个人凭据（App ID / App Secret），无法通过现有的严格 args 匹配检测，需要新增 `mcp_key_only` 检测方式。

## Problem Frame

`spec-mcp-setup` 已为 3 个 required 工具提供一键检测与安装，但缺少对飞书 MCP 的支持。计划中的 `feishu-chat-researcher` / `feishu-doc-reader` agent 在运行时依赖飞书 MCP 正确配置，目前没有自动化检测、安装引导和可达性验证路径。（see origin: `docs/brainstorms/2026-04-14-feishu-mcp-setup-integration-requirements.md`）

## Requirements Trace

- R1. `mcp-tools.json` 新增 `feishu` 条目，`category: optional`，`detect.method: mcp_key_only`
- R2. `detect-tools.sh` 新增 `mcp_key_only` 分支：只检测 key 存在，不校验 args
- R3. `detect-tools.ps1` 同步 Windows 版 `mcp_key_only` 分支
- R4. `install-coordinator.sh` 新增 `install_feishu` 函数：交互采集凭据，生成配置并写入
- R5. `install-coordinator.ps1` 同步 Windows 版安装引导
- R6. 安装引导展示飞书开放平台应用申请入口
- R7. `verify-tools.sh` 新增飞书 `mcp_key_only` 检测 + `whoami` 可达性验证
- R8. `verify-tools.ps1` 同步 Windows 版验证逻辑
- R9. `SKILL.md` 工具总览表格新增飞书行

## Scope Boundaries

- 不含：`feishu-chat-researcher` / `feishu-doc-reader` agent 实现
- 安装引导通过 `claude mcp add-json` 自动写入配置（与 playwright 等 optional 工具的现有安装路径一致）；不提供仅展示模式
- 不含：`--token-mode` / `--tools` 等高级参数的 UI 引导
- 不改变：`setup_success` 门控逻辑（仍只看 3 个 required 工具）

## Context & Research

### Relevant Code and Patterns

- `detect-tools.sh:42-98`：`case "$detect_method" in` switch — 在 `"command"` 分支后新增 `"mcp_key_only"` 分支，使用与 `"mcp_config"` 相同的 `detect_key` 读取模式
- `detect-tools.ps1:71-119`：`switch ($tool.detect.method)` — 新增 `'mcp_key_only'` case，复用 `Get-TomlSection` 检测 Codex，复用 `$config.mcpServers.PSObject.Properties` 检测 Claude
- `install-coordinator.sh:156-169`：`tool_is_configured()` 已有 key-only 检查模式（`jq -e --arg id "$tool_id" '.mcpServers[$id]'`）——`install_feishu` 的"是否已配置"判断可复用此函数
- `install-coordinator.sh:171-199`：`add_tool_config()` 使用 `cli_command mcp add-json "$tool_id" "$config_json"`（Claude）或 `cli_command mcp add "$tool_id" -- ...`（Codex）——`install_feishu` 凭采集到真实凭据后可照此调用
- `install-coordinator.sh:318-403`：`main()` 主循环通过 `configure_tool "$tool_id"` 调度；feishu 需在循环内检测 `tool_id == "feishu"` 并转至 `install_feishu`
- `verify-tools.sh:31-76`：`check_mcp_configured()` 做严格 args 匹配；新增 `check_mcp_key_only()` 参照此函数但只检测 key 存在（Claude：`jq -e '.mcpServers[$key] != null'`，Codex：`grep -qF "[mcp_servers.$key]"`）
- `verify-tools.sh:106-118`：工具状态硬编码变量 + `setup_success` 门控；feishu 独立赋值，不纳入 `setup_success`
- `verify-tools.ps1:104-108`：相同模式的 PowerShell 版

### Institutional Learnings

- 现有 `command` 检测分支（`detect-tools.sh:79-98`）使用超时保护（`timeout 10 / perl alarm`）；飞书 `whoami` 同样需要超时，模式一致
- `install-coordinator.sh` 已有空输入 `return` 模式（无 lock 时的提前退出），`install_feishu` 的凭据为空跳过路径应与此风格一致

## Key Technical Decisions

- **`mcp_key_only` 而非 `mcp_config`**：飞书 MCP 的 `--app-id` / `--app-secret` 是每用户不同的运行时凭据，严格 args 匹配对所有用户失败。只检测 key 存在是最小有效检测，与"知道工具是否配置"的语义对齐（see origin）
- **`install_feishu` 绕过 `add_tool_config()`**：通用 `add_tool_config()` 无占位符替换能力，且 feishu 需先采集凭据。`install_feishu` 采集后直接拼装完整 config JSON 并调用 `cli_command mcp add-json`，保持与已有 Claude adapter 写配置路径一致
- **主循环按 tool_id 分发**：在 main() 循环中检测 `tool_id == "feishu"` 并调用 `install_feishu()`，其余工具保持原有 `configure_tool()` 路径。简单直接，不引入新抽象（YAGNI）
- **`verify-tools.sh` 新增 `check_mcp_key_only()`**：独立函数而非修改 `check_mcp_configured()`，避免改动对 3 个 required 工具已有的严格检测逻辑；whoami 作为独立验证步骤，有超时保护
- **`setup_success` 不变**：飞书是 optional，不应阻塞 bootstrap Host Readiness Gate

## Open Questions

### Resolved During Planning

- **Q: Codex TOML `mcp_key_only` 检测格式**：已确认 `extract_toml_section()` 使用 `awk -v section="[mcp_servers.$key]"` 精确匹配头部行；`check_mcp_key_only` 用 `grep -qF "[mcp_servers.$key]"` 与之等价
- **Q: feishu install 是否触发**：`should_install "feishu" "optional"` 默认返回 false；只有明确传 `--install feishu` 时才触发，与 playwright 等 optional 工具一致
- **Q: `verify-tools.sh` JSON 版本**：feishu 字段追加到 `tools` map 不改变现有字段，不强制消费方升级；版本号是否需要从 "5" 升至 "6" 留到实现时确认（依赖确认 spec-bootstrap 是否检查版本字段）

### Deferred to Implementation

- **`install_feishu` Codex 路径**：Codex `mcp add` 的确切 CLI 参数格式（`codex mcp add feishu -- npx ... --app-id "$ID" ...`）需在实现时通过代码验证确认
- **`whoami` 超时值**：建议 10 秒（与 `command` 检测对齐），但若飞书首次下载 npx 包速度较慢，可能需要调整
- **`verify-tools.sh` version bump 确认**：读取 `spec-bootstrap` 中 `host-setup.json` 的消费方，确认是否版本敏感

## High-Level Technical Design

> *此图示意预期改动架构，为评审提供方向性参考，非实现规范。*

```
mcp-tools.json
  feishu entry:
    category: optional
    detect.method: mcp_key_only  ← 新
    detect.key: feishu
    mcp_config: { npx ... --app-id __FEISHU_APP_ID__ ... }  ← 模板（install不直接用）

detect-tools.sh/ps1
  case "mcp_key_only":
    Claude: jq '.mcpServers[$key] != null'
    Codex:  grep -qF "[mcp_servers.feishu]"

install-coordinator.sh/ps1
  main() loop:
    if tool_id == "feishu":
      install_feishu()           ← 新分支
        read FEISHU_APP_ID
        read FEISHU_APP_SECRET
        if empty → skip + hint
        cli_command mcp add-json feishu <complete_config>
    else:
      configure_tool()           ← 不变

verify-tools.sh/ps1
  check_mcp_key_only("feishu")  ← 新函数
  if feishu configured:
    whoami → ok / warn           ← 新步骤
  JSON output.tools.feishu = { configured, whoami }
  setup_success 不变
```

## Implementation Units

- [ ] **Unit 1: mcp-tools.json 新增 feishu 条目**

**Goal:** 为飞书 MCP 建立工具注册基线，其他所有脚本依赖此条目

**Requirements:** R1

**Dependencies:** 无

**Files:**
- Modify: `skills/spec-mcp-setup/mcp-tools.json`

**Approach:**
- 在 `tools` 数组末尾追加 feishu 对象，`category: optional`，`dependencies: ["node"]`
- `mcp_config.args` 使用占位符 `__FEISHU_APP_ID__` 和 `__FEISHU_APP_SECRET__`（install 流程不直接消费，仅作模板文档）
- `detect.method: "mcp_key_only"`，`detect.key: "feishu"`

**Patterns to follow:**
- `mcp-tools.json:52-64`（playwright 条目结构）

**Test scenarios:**
- Happy path: `jq '.tools[] | select(.id == "feishu")` 返回完整对象，含 `detect.method == "mcp_key_only"`
- Edge case: 新条目不影响 `jq '.tools[].id'` 枚举（原 4 个工具正常返回）

**Verification:**
- `jq '.tools | length'` 返回 5
- `jq -r '.tools[] | select(.id == "feishu") | .detect.method'` 返回 `mcp_key_only`

---

- [ ] **Unit 2: detect-tools.sh 新增 mcp_key_only 检测分支**

**Goal:** 让 detect-tools.sh 能正确报告飞书 MCP 配置状态

**Requirements:** R2

**Dependencies:** Unit 1

**Files:**
- Modify: `skills/spec-mcp-setup/scripts/detect-tools.sh`
- Test: `tests/unit/mcp-setup.sh`（现有验证脚本，参考是否需扩展）

**Approach:**
- 在 `case "$detect_method" in` 的 `"command")` 分支之前插入 `"mcp_key_only")` 分支
- 从 `mcp-tools.json` 读 `detect.key`（与 `mcp_config` 分支同模式）
- Claude host：`jq -e --arg key "$detect_key" '.mcpServers[$key] != null' "$CONFIG_PATH"`
- Codex host：`grep -qF "[mcp_servers.${detect_key}]" "$CONFIG_PATH"`（与 `tool_is_configured()` 的 Codex 路径一致）

**Patterns to follow:**
- `detect-tools.sh:43-76`（mcp_config 分支结构）
- `install-coordinator.sh:162-168`（Codex key 检测方式）

**Test scenarios:**
- Happy path（Claude）：`~/.claude.json` 存在且 `mcpServers.feishu` 有内容 → `installed: ["feishu"]`
- Happy path（Codex）：config.toml 含 `[mcp_servers.feishu]` → `installed: ["feishu"]`
- Edge case：config 文件不存在 → `missing: ["feishu"]`
- Edge case：`mcpServers.feishu` 为 null 值 → `missing`
- Integration：其他 3 个 required 工具检测结果不受影响（回归）

**Verification:**
- 对含 feishu key 的 mock config，`detect-tools.sh` 输出 `installed` 数组含 `"feishu"`
- 对不含 feishu key 的 config，输出 `missing` 数组含 `"feishu"`

---

- [ ] **Unit 3: detect-tools.ps1 同步 mcp_key_only 分支（Windows）**

**Goal:** Windows 版检测与 shell 版行为一致

**Requirements:** R3

**Dependencies:** Unit 1

**Files:**
- Modify: `skills/spec-mcp-setup/scripts/detect-tools.ps1`

**Approach:**
- 在 `switch ($tool.detect.method)` 的 `'command'` case 后新增 `'mcp_key_only'` case
- Claude：`$config.mcpServers.PSObject.Properties[$detectKey].Value -ne $null`（参照现有 `mcp_config` 的 Claude 路径）
- Codex：`Select-String -Path $ConfigPath -SimpleMatch "[mcp_servers.$detectKey]" -Quiet`（参照 `verify-tools.ps1:67`）

**Patterns to follow:**
- `detect-tools.ps1:71-119`（switch 结构）
- `verify-tools.ps1:67-76`（Codex key 检测）

**Test scenarios:**
- Happy path（Claude）：JSON config 含 feishu key → installed
- Happy path（Codex）：TOML 含 `[mcp_servers.feishu]` → installed
- Edge case：配置文件不存在 → missing

**Verification:**
- 与 detect-tools.sh 相同场景，PowerShell 版输出 JSON 结果一致

---

- [ ] **Unit 4: install-coordinator.sh 新增飞书安装引导**

**Goal:** 交互采集凭据并写入飞书 MCP 配置，跳过空凭据时给出手动配置提示

**Requirements:** R4, R6

**Dependencies:** Unit 1, Unit 2

**Files:**
- Modify: `skills/spec-mcp-setup/scripts/install-coordinator.sh`

**Approach:**
- 新增 `install_feishu()` 函数：
  - 先检测 `tool_is_configured "feishu"` —— 已配置则直接返回
  - 输出飞书开放平台链接 `https://open.feishu.cn/app`
  - `read -r -p` 采集凭据，**必须加 `|| true` 防护**（`read ... || FEISHU_APP_ID=""`），避免 `set -euo pipefail` 在 stdin EOF 时非预期退出；Codex 路径同理
  - 任一为空 → 打印跳过提示，return（不 exit）
  - 用 `jq -n` 构造完整 config JSON（替换真实值，不使用占位符）
  - Claude：`"$CLI_COMMAND" mcp add-json --scope user feishu "$FEISHU_CONFIG"`
  - Codex：`"$CLI_COMMAND" mcp add feishu -- npx -y @larksuiteoapi/lark-mcp mcp --app-id "$FEISHU_APP_ID" --app-secret "$FEISHU_APP_SECRET" --language zh`
- 在 `main()` 主循环中，在 `configure_tool "$tool_id"` 调用前，插入：`if [ "$tool_id" = "feishu" ]; then install_feishu; continue; fi`

**Patterns to follow:**
- `install-coordinator.sh:156-169`（`tool_is_configured()` 调用模式）
- `install-coordinator.sh:171-199`（`add_tool_config()` 中 claude mcp add-json 调用模式）
- `install-coordinator.sh:288-316`（`configure_tool()` 输出风格）

**Test scenarios:**
- Happy path：输入有效 App ID + Secret → Claude 用 `mcp add-json` 写配置，输出 ✅
- Edge case（空凭据）：App ID 为空 → 打印跳过提示，不写配置，不 exit
- Edge case（已配置）：`tool_is_configured "feishu"` 为真 → 输出 ⏭️ skipping
- Edge case（非交互）：piped input 下 `read` 返回空 → 走空凭据路径，优雅跳过
- Integration：其他工具安装流程不受影响（回归）

**Verification:**
- 传 `--install feishu` 并提供有效凭据后，`detect-tools.sh` 输出 `installed: ["feishu"]`
- 传 `--install feishu` 且凭据为空，脚本退出码为 0（不 exit 1）

---

- [ ] **Unit 5: install-coordinator.ps1 同步飞书安装引导（Windows）**

**Goal:** Windows 版安装引导与 shell 版行为一致

**Requirements:** R5, R6

**Dependencies:** Unit 1, Unit 3

**Files:**
- Modify: `skills/spec-mcp-setup/scripts/install-coordinator.ps1`

**Approach:**
- 新增 `Install-Feishu` 函数，结构与 sh 版一致
- PowerShell 凭据采集用 `Read-Host -Prompt`
- 已配置检测：参照现有 `Tool-IsConfigured` 函数（若存在），否则内联检测
- CLI 调用参照现有 `$CliCommand mcp add-json` 模式（参见 ps1 文件后半段）

**Patterns to follow:**
- `install-coordinator.ps1:35-50`（Should-Install 模式）
- PowerShell `Read-Host` 为标准交互采集方式

**Test scenarios:**
- Happy path：输入有效凭据 → 配置写入成功
- Edge case：凭据为空 → 跳过，无错误
- Edge case：已配置 → 输出 skipping，不重复写入

**Verification:**
- Windows 环境下，传 `-Install feishu` 并提供凭据后，detect-tools.ps1 检测到 feishu installed

---

- [ ] **Unit 6: verify-tools.sh 新增飞书 key 检测与 whoami 验证**

**Goal:** verify-tools.sh 能反映飞书 MCP 配置状态，并可选地验证凭据有效性

**Requirements:** R7

**Dependencies:** Unit 1, Unit 2

**Files:**
- Modify: `skills/spec-mcp-setup/scripts/verify-tools.sh`

**Approach:**
- 新增 `check_mcp_key_only()` 函数：接受 tool_id 参数，只检测 key 存在
  - Claude：`jq -e --arg key "$1" '.mcpServers[$key] != null' "$CONFIG_PATH" >/dev/null 2>&1 && echo "true" || echo "false"`
  - Codex：`grep -qF "[mcp_servers.$1]" "$CONFIG_PATH" && echo "true" || echo "false"`
- 在已有工具变量声明后追加：`feishu_configured=$(check_mcp_key_only "feishu")`
- whoami 验证（可选段，仅在 feishu_configured 为 true 时执行，带超时保护）
  - 超时逻辑参照 `command` 检测分支（`timeout 10 / perl alarm 10`）
  - 成功：`feishu_whoami="ok"`；失败：`feishu_whoami="failed"`
- 更新输出 JSON 的 `tools` map，追加 feishu 字段：`"feishu": { "configured": $feishu_configured, "whoami": "$feishu_whoami" }`
- `setup_success` 门控不变，不加入 feishu

**Patterns to follow:**
- `verify-tools.sh:31-76`（`check_mcp_configured()` 结构）
- `detect-tools.sh:79-98`（超时保护模式）
- `verify-tools.sh:146-173`（jq -n JSON 组装）

**Test scenarios:**
- Happy path（feishu 已配置，whoami 成功）：输出 `tools.feishu.configured: true, tools.feishu.whoami: "ok"`
- Happy path（feishu 未配置）：输出 `tools.feishu.configured: false`，跳过 whoami
- Error path（feishu 已配置但凭据错误，whoami 失败）：输出 `tools.feishu.whoami: "failed"` + 警告
- Integration：`setup_success` 仍只看 serena + context7 + sequential-thinking（回归）
- Edge case：config 文件不存在 → `feishu_configured: false`

**Verification:**
- `cat host-setup.json | jq '.tools.feishu'` 返回含 `configured` 字段的对象
- `setup_success` 字段不受 feishu 配置状态影响

---

- [ ] **Unit 7: verify-tools.ps1 同步飞书验证逻辑（Windows）**

**Goal:** Windows 版验证与 shell 版行为一致

**Requirements:** R8

**Dependencies:** Unit 1, Unit 3

**Files:**
- Modify: `skills/spec-mcp-setup/scripts/verify-tools.ps1`

**Approach:**
- 新增 `Check-McpKeyOnly` 函数，参照 `Check-McpConfigured` 结构但只检测 key 存在
- 追加 `$feishuConfigured = Check-McpKeyOnly 'feishu'`
- whoami 验证：使用 `Start-Process ... -PassThru` + `WaitForExit(10000)` 模式（参照 `detect-tools.ps1:108-118`）
- 更新 `$payload.tools` 追加 feishu 字段

**Patterns to follow:**
- `verify-tools.ps1:34-102`（Check-McpConfigured 结构）
- `detect-tools.ps1:108-118`（timeout 模式）

**Test scenarios:**
- 与 sh 版等价的 happy path / error path / integration 场景

**Verification:**
- `host-setup.json` 中 `tools.feishu` 字段存在且结构与 sh 版一致

---

- [ ] **Unit 8: SKILL.md 工具总览表格新增飞书行**

**Goal:** 用户运行 spec-mcp-setup 前能从文档了解飞书 MCP 是可选工具

**Requirements:** R9

**Dependencies:** 无（可独立完成）

**Files:**
- Modify: `skills/spec-mcp-setup/SKILL.md`

**Approach:**
- 在 `## Overview` 表格（当前第 18-25 行）的 `| Playwright MCP | Optional | ...` 行后追加：`| 飞书 MCP | Optional | 飞书聊天与文档 API（feishu-chat-researcher / feishu-doc-reader 依赖）|`

**Patterns to follow:**
- `SKILL.md:18-25`（现有表格格式）

**Test scenarios:**
- 文档可读性：表格格式正确，列对齐

**Verification:**
- `SKILL.md` 表格含 `飞书 MCP` 行，`category` 为 `Optional`

## System-Wide Impact

- **Interaction graph:** `spec-bootstrap` 消费 `host-setup.json`（由 `verify-tools.sh` 写入）；feishu 字段追加不破坏已有字段读取。`setup_success` 门控不变，bootstrap Host Readiness Gate 行为不受影响
- **Error propagation:** `install_feishu` 在凭据为空或 CLI 写入失败时不应中断整个 install-coordinator 运行（不 `exit 1`，仅 `return`）；失败信息输出到 stderr 或 stdout 带 ⚠️ 标识
- **API surface parity:** detect/install/verify 三个脚本的 shell 版和 ps1 版必须在语义上完全对等，包括输出 JSON 结构
- **Unchanged invariants:** serena / sequential-thinking / context7 的检测、安装、验证逻辑不受任何改动；`setup_success` 门控条件不变；mcp-tools.json 中其他条目的 `mcp_config` 检测路径不变

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `install_feishu` 在非交互环境（CI、管道输入）下 `read` 遇 EOF 触发 `set -e` 导致脚本提前退出 | `read` 必须加 `\|\| true` 防护（`read ... \|\| FEISHU_APP_ID=""`），将 exit code 1 转为空值，走空凭据跳过路径 |
| `whoami` 首次运行需 npx 下载包，超时时间不够 | 10s 超时与 `command` 检测对齐，失败时输出警告而非错误，不阻塞 setup_success |
| Codex `mcp add feishu` 参数格式未在代码库中验证 | 实现时先读 codex 帮助输出确认 CLI 格式；已在 Open Questions 标注 |
| `verify-tools.sh` JSON version 字段消费方敏感 | 实现时读 spec-bootstrap Host Readiness Gate 逻辑，确认是否版本敏感后再决定是否升版本号 |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-14-feishu-mcp-setup-integration-requirements.md](docs/brainstorms/2026-04-14-feishu-mcp-setup-integration-requirements.md)
- **业界分析参考:** docs/业界分析/15.spec-mcp-setup-集成飞书MCP技术方案-2026-04-14.md
- 飞书 MCP 包: `@larksuiteoapi/lark-mcp@0.5.1`
- 相关代码:
  - `skills/spec-mcp-setup/mcp-tools.json`
  - `skills/spec-mcp-setup/scripts/detect-tools.sh`
  - `skills/spec-mcp-setup/scripts/detect-tools.ps1`
  - `skills/spec-mcp-setup/scripts/install-coordinator.sh`
  - `skills/spec-mcp-setup/scripts/install-coordinator.ps1`
  - `skills/spec-mcp-setup/scripts/verify-tools.sh`
  - `skills/spec-mcp-setup/scripts/verify-tools.ps1`
  - `skills/spec-mcp-setup/SKILL.md`
