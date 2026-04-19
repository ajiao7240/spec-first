# mcp-setup 执行流程

> 更新于 2026-04-08

## 总览

```
╔══════════════════════════════════════════════════════════════════════════╗
║                    /spec:mcp-setup [quick|custom]                        ║
╚══════════════════════════════════════════════════════════════════════════╝
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Phase 1: 依赖检测                                                         │
│                                                                          │
│  bash scripts/check-deps.sh   /  pwsh -File scripts/check-deps.ps1       │
│  ┌─────────────────────────────────────────────┐                        │
│  │ 检测: node / uv / jq                        │                        │
│  │ 输出: { node, uv, jq }                      │                        │
│  └──────────────┬──────────────────────────────┘                        │
│                 │                                                        │
│         ┌───────┴────────┐                                               │
│         │ 有缺失依赖?     │                                               │
│      yes│                │no                                             │
│         ▼                ▼                                               │
│  AskUserQuestion    继续 Phase 2                                          │
│  ┌──────────────┐                                                        │
│  │ safe_auto    │→ 直接执行 (uv, jq)                                     │
│  │ gated_auto   │→ 提示风险后执行 (node)                                 │
│  │ 用户拒绝     │→ 显示手动安装说明，退出                                  │
│  └──────┬───────┘                                                        │
│         │ 安装后 re-run 匹配平台的依赖脚本验证                           │
└─────────┼───────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Phase 2: 检测 + 配置合并                                                 │
│                                                                          │
│  bash scripts/detect-tools.sh /  pwsh -File scripts/detect-tools.ps1     │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ detect-host.sh → current host config / marker                     │    │
│  │ host ambiguous? → require MCP_SETUP_HOST                         │    │
│  │ 读取当前宿主配置文件 mcpServers                                  │    │
│  │ 遍历 mcp-tools.json 中 4 个工具                                  │    │
│  │  mcp_config → 检查 mcpServers[key] 存在否                        │    │
│  │ 输出: { installed: [...], missing: [...] }                        │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                           │                                              │
│                           ▼                                              │
│  bash scripts/install-coordinator.sh --install <missing_required>        │
│  pwsh -File scripts/install-coordinator.ps1 -Install <missing_required>  │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  acquire_lock (flock / mkdir fallback)                           │    │
│  │  backup current host config → .backup.<timestamp>                │    │
│  │  add missing mcpServers / mcp_servers entries via host CLI       │    │
│  │  verify entry exists after CLI returns                           │    │
│  │  all success → rm backup                                         │    │
│  │  any failure → preserve backup, exit 1                           │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Phase 3: 可选工具（quick 模式跳过）                                      │
│                                                                          │
│  AskUserQuestion: 安装 Playwright MCP?                                   │
│       yes → install-coordinator.sh --install playwright                  │
│       no  → 跳过                                                         │
└─────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Phase 4: Host Verification                                               │
│                                                                          │
│  bash scripts/verify-tools.sh / pwsh -File scripts/verify-tools.ps1      │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ detect current host marker path                                  │    │
│  │ 检测 mcp config / setup_success                                 │    │
│  │ atomic write → current host spec-first/host-setup.json (v4)     │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│           │ exit!=0 or setup_success=false                               │
│           └──────────────────────────── 报错，终止                        │
└─────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Verification Summary                                                     │
│                                                                          │
│  re-run detect-tools.sh                                                  │
│  read current host host-setup.json → confirm setup_success=true         │
│                                                                          │
│  ✅ MCP Tools Setup Complete                                              │
│  下一步: 1) 重启当前宿主  2) /spec:graph-bootstrap                       │
└─────────────────────────────────────────────────────────────────────────┘
```

## 关键数据流

```
mcp-tools.json ──► detect-tools.sh ──► install-coordinator.sh ──► current host config
      │                                                                   │
      └──────────────────────────────────── verify-tools.sh ◄────────────┘
                                                    │
                                                    ▼
                                     host-setup.json (v4 schema)
                                     ├── setup_success (baseline gate)
                                     ├── host (marker selection)
                                     └── tools.*.configured
```

## `setup_success` 判定规则

| 工具 | 是否阻断 |
|------|---------|
| serena | **阻断** |
| context7 | **阻断** |
| sequential-thinking | **阻断** |

## 依赖安全等级

| 依赖 | 等级 | 行为 |
|------|------|------|
| uv | `safe_auto` | 直接执行，安装到 `~/.cargo/bin/` |
| jq | `safe_auto` | `brew install jq` / `apt install jq` |
| Node.js | `gated_auto` | 提示冲突风险后执行（via fnm） |

## 相关文件

| 文件 | 职责 |
|------|------|
| `skills/mcp-setup/mcp-tools.json` | 工具元数据 |
| `scripts/check-deps.sh` / `check-deps.ps1` | 检测 node/uv/jq，输出 install_suggestion |
| `scripts/detect-tools.sh` / `detect-tools.ps1` | 读当前宿主配置文件判断工具安装状态 |
| `scripts/install-coordinator.sh` / `install-coordinator.ps1` | 按宿主 CLI 配置合并与原子写入 |
| `scripts/verify-tools.sh` / `verify-tools.ps1` | 写当前宿主的 `host-setup.json`，供 spec-graph-bootstrap 读取 |
| 当前宿主配置文件 | MCP server 配置目标文件 |
| 当前宿主的 `spec-first/host-setup.json` | Host 就绪状态标记（v4 schema） |
