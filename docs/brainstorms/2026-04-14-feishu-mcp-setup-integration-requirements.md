---
date: 2026-04-14
topic: feishu-mcp-setup-integration
---

# spec-mcp-setup 集成飞书 MCP

## Problem Frame

`spec-mcp-setup` 已为 serena / sequential-thinking / context7 提供一键检测与安装流程，但缺少对飞书 MCP（`@larksuiteoapi/lark-mcp`）的支持。计划中的 `feishu-chat-researcher` / `feishu-doc-reader` agent 依赖飞书 MCP 正确配置才能运行，目前没有任何自动化检测、安装引导和验证路径。

## Requirements

**检测基础设施**

- R1. `mcp-tools.json` 新增 `feishu` 工具条目，`category: optional`，依赖 `node`，`detect.method` 为新增的 `mcp_key_only`
- R2. `detect-tools.sh` 新增 `mcp_key_only` 分支：只检测 `mcpServers` 中该 key 是否存在，不校验 command/args（兼容每用户不同的运行时凭据）
- R3. `detect-tools.ps1` 同步新增等效的 `mcp_key_only` 分支（Windows 一致性）

**安装引导**

- R4. `install-coordinator.sh` 新增 `install_feishu` 函数：交互式询问用户的 App ID 和 App Secret，凭据为空时跳过并给出后续手动配置提示；成功输入后生成标准 `mcpServers` 配置块，向用户展示并引导写入配置文件
- R5. `install-coordinator.ps1` 同步新增等效的安装引导流程（Windows 一致性）
- R6. 安装引导中展示飞书开放平台应用申请入口 `https://open.feishu.cn/app`

**验证**

- R7. `verify-tools.sh` 新增飞书 MCP 可达性验证：若已配置，执行 `npx @larksuiteoapi/lark-mcp whoami`，成功则输出已验证，失败则提示检查凭据
- R8. `verify-tools.ps1` 同步新增等效验证逻辑（Windows 一致性）

**文档与用户可见性**

- R9. `skills/spec-mcp-setup/SKILL.md` 工具总览表格新增飞书 MCP 行（Optional，用途描述）

## Success Criteria

- `detect-tools.sh` 对已配置飞书 MCP 的环境输出 `installed: ["feishu"]`
- `detect-tools.sh` 对未配置环境输出 `missing: ["feishu"]`
- `install-coordinator.sh` 能引导用户输入 App ID / Secret 并生成正确的配置块
- `verify-tools.sh` 能通过 `whoami` 区分凭据有效与无效
- 原有 required tools（serena / sequential-thinking / context7）检测行为不受影响
- Windows PowerShell 版本与 shell 版本行为一致

## Scope Boundaries

- **不包含**：`feishu-chat-researcher` / `feishu-doc-reader` agent 的实现（依赖本文基础设施，但属于独立工作项，见 doc 14）
- **不包含**：自动写入 mcpServers 配置（安装引导仅生成配置块并展示，用户手动写入，与现有可选工具安装策略一致）
- **不包含**：`--token-mode` / `--tools` 等高级参数的 UI 引导（可后续扩展）

## Key Decisions

- **`mcp_key_only` 而非 `mcp_config`**：飞书 MCP 的 `--app-id` / `--app-secret` 是用户个人凭据，严格 args 匹配会对所有用户失败。`mcp_key_only` 只检测 key 存在，是最小有效检测
- **`optional` 分类**：飞书 MCP 不是 spec-first 核心工作流的必要依赖，而是特定 agent 场景的增强依赖
- **`--language zh` 硬编码**：默认模板固定中文，与当前项目语言设置一致；如需多语言支持，推迟到后续版本

## Dependencies / Assumptions

- `@larksuiteoapi/lark-mcp` 0.5.1 的 `mcp whoami` 子命令可作为最小凭据验证手段
- 飞书开放平台应用凭据由用户自行申请，spec-mcp-setup 不负责应用创建流程

## Outstanding Questions

### Resolve Before Planning

（无阻塞项）

### Deferred to Planning

- [Affects R4][Technical] `install-coordinator.sh` 的 `missing` 列表路由逻辑是否需要调整以触发 `install_feishu`，或已有通用触发框架？需在实现时确认
- [Affects R2/R3][Technical] Codex TOML 格式下的 `mcp_key_only` 检测：`grep -q "^\[mcp_servers.feishu\]"` 是否覆盖所有 TOML 格式变体？建议在 planning 中验证

## Next Steps

→ `/spec:plan` 进行结构化实现规划
