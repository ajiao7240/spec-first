# mcp-setup 执行流程

> 更新于 2026-04-07

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
│  bash scripts/check-deps.sh                                              │
│  ┌─────────────────────────────────────────────┐                        │
│  │ 检测: node / go / uv / jq                   │                        │
│  │ 输出: { node, go, uv, jq } (带 install_suggestion)│                 │
│  └──────────────┬──────────────────────────────┘                        │
│                 │                                                        │
│         ┌───────┴────────┐                                               │
│         │ 有缺失依赖?     │                                               │
│      yes│                │no                                             │
│         ▼                ▼                                               │
│  AskUserQuestion    继续 Phase 2                                          │
│  ┌──────────────┐                                                        │
│  │ safe_auto    │→ 直接执行 (uv, jq)                                     │
│  │ gated_auto   │→ 提示风险后执行 (node, go)                              │
│  │ 用户拒绝     │→ 显示手动安装说明，退出                                  │
│  └──────┬───────┘                                                        │
│         │ 安装后 re-run check-deps.sh 验证                               │
└─────────┼───────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Phase 2: 检测 + 安装 + 配置合并                                           │
│                                                                          │
│  bash scripts/detect-tools.sh                                            │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ 读取 ~/.claude.json mcpServers                                   │    │
│  │ 遍历 mcp-tools.json 中 6 个工具                                  │    │
│  │  mcp_config → 检查 mcpServers[key] 存在否                        │    │
│  │  command    → eval detect.command 成功否 (abcoder)               │    │
│  │ 输出: { installed: [...], missing: [...] }                        │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                           │                                              │
│                           ▼                                              │
│  bash scripts/install-coordinator.sh --install <missing_required>        │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  acquire_lock (flock / mkdir fallback)                           │    │
│  │  backup ~/.claude.json → .backup.<timestamp>                     │    │
│  │                                                                  │    │
│  │  for each required tool:                                         │    │
│  │  ┌──────────────────────────────────────────────────────────┐   │    │
│  │  │ has install_command?    has mcp_config?                   │   │    │
│  │  │ (abcoder)               (serena/gitnexus/ctx7/seqthk)    │   │    │
│  │  │      │                        │                           │   │    │
│  │  │      ▼                        ▼                           │   │    │
│  │  │ go install …          jq merge → tmpfile                  │   │    │
│  │  │                       validate JSON                       │   │    │
│  │  │                       chmod 600 → mv (atomic)             │   │    │
│  │  └──────────────────────────────────────────────────────────┘   │    │
│  │                                                                  │    │
│  │  all success → rm backup                                         │    │
│  │  any failure → preserve backup, exit 1                           │    │
│  │  release_lock                                                    │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Phase 3: 可选工具  (quick 模式跳过)                                       │
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
│  4.1 配置 ABCoder MCP server                                             │
│       abcoder version ✓ && mcpServers.abcoder 未配置                     │
│       → jq写入 {"command":"abcoder","args":["mcp",~/.claude/abcoder-ast]}│
│                                                                          │
│  4.2 bash scripts/verify-tools.sh                                        │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ 检测 abcoder binary / 各工具 mcp config / java/go/python runtime │    │
│  │ 检测 JDT cache 可写性 (仅 abcoder+java 存在时)                   │    │
│  │                                                                  │    │
│  │ setup_success = serena ∧ context7 ∧ sequential-thinking 均 configured│    │
│  │                                                                  │    │
│  │ atomic write → ~/.claude/spec-first/host-setup.json (v2 schema) │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│           │ exit!=0 or setup_success=false                               │
│           └──────────────────────────── 报错，终止                        │
│                                                                          │
│  4.3 Language Preflight (读 host-setup.json)                             │
│       jdt_cache.writable=false?                                          │
│       → AskUserQuestion: 执行 chmod -R u+w <jdt_parent>?                │
│       → 修复后 re-run verify-tools.sh                                    │
└─────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Verification Summary                                                     │
│                                                                          │
│  re-run detect-tools.sh                                                  │
│  read host-setup.json → confirm setup_success=true                       │
│                                                                          │
│  ✅ MCP Tools Setup Complete                                              │
│  下一步: 1) 重启 Claude Code  2) /spec:bootstrap                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 关键数据流

```
mcp-tools.json ──► detect-tools.sh ──► install-coordinator.sh ──► ~/.claude.json
      │                                                                   │
      │ (mcp_config entries)                                              │
      └──────────────────────────────────── verify-tools.sh ◄────────────┘
                                                    │
                                                    ▼
                                     host-setup.json (v2 schema)
                                     ├── setup_success (baseline gate)
                                     ├── tools.*.configured
                                     ├── java_runtime / language_runtime
                                     └── jdt_cache (writable + reason)
```

## `setup_success` 判定规则

| 工具 | 是否阻断 |
|------|---------|
| serena | **阻断** — 缺失则 `setup_success=false` |
| context7 | **阻断** |
| sequential-thinking | **阻断** |
| abcoder | 非阻断 — 缺失仅降级到 Enhanced mode |
| gitnexus | 非阻断 — 缺失仅降级到 Enhanced mode |

## 依赖安全等级

| 依赖 | 等级 | 行为 |
|------|------|------|
| uv | `safe_auto` | 直接执行，安装到 `~/.cargo/bin/` |
| jq | `safe_auto` | `brew install jq` / `apt install jq` |
| Node.js | `gated_auto` | 提示冲突风险后执行（via fnm） |
| Go | `gated_auto` | 提示需配置 PATH 后执行 |

## 相关文件

| 文件 | 职责 |
|------|------|
| `skills/mcp-setup/mcp-tools.json` | 工具元数据（id / category / mcp_config / detect） |
| `scripts/check-deps.sh` | 检测 node/go/uv/jq，输出 install_suggestion |
| `scripts/detect-tools.sh` | 读 `~/.claude.json` 判断工具安装状态 |
| `scripts/install-coordinator.sh` | 安装二进制 + 原子合并 mcpServers 配置 |
| `scripts/verify-tools.sh` | 写 `host-setup.json`，供 spec-bootstrap 读取 |
| `~/.claude.json` | MCP server 配置目标文件 |
| `~/.claude/spec-first/host-setup.json` | Host 就绪状态标记（v2 schema） |
