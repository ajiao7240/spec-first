# spec-first-session.v1 合同

## 定位

`spec-first-session.v1` 是 multi-actor worktree 治理（plan
`2026-05-14-002`）的 **opt-in advisory** schema。它用于让多个并行的
agent session 在共用同一仓库 worktree 时**互相感知**，但不强制 lock、
不阻塞、不做中心化协调。脚本只输出可观测事实，是否避让由 LLM 判断。

未启用时（`.spec-first/sessions/` 不存在或为空）所有现有 spec-first
skill 行为完全不变。

## 存放位置

每个 active session 写一个独立 advisory 文件：

```
<repo>/.spec-first/sessions/<session-id>.json
```

`.spec-first/sessions/` 已被仓库根目录 `.gitignore` 排除，是 generated
runtime state，不入 git。

## 字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `schema_version` | const `"spec-first-session.v1"` | 是 | 版本标识 |
| `session_id` | string | 是 | 仅 `[A-Za-z0-9._-]`，最长 128；建议 UUID |
| `agent_kind` | enum `claude-code` / `codex` / `other` | 是 | 调用方 agent 类型 |
| `started_at` | ISO8601 UTC | 是 | session 注册时间 |
| `last_heartbeat_at` | ISO8601 UTC | 是 | 最近一次心跳时间 |
| `host_marker_path` | string \| null | 否 | 当前宿主 readiness ledger 路径（来自 `runtime-capabilities.json`）；必须是精确 repo-relative path |
| `scope_hint` | string \| null | 否 | 自由文本，建议放 task code 或工作主题，最长 512；拒绝绝对路径、Windows drive、parent traversal、反斜杠和控制字符 |
| `pid` | integer \| null | 否 | 调用方进程号；用于辅助 stale 判断 |

## CLI 入口

由 `spec-first session` 子命令提供：

```bash
spec-first session register   [--id <id>] [--agent-kind <kind>] [--scope-hint <text>] [--json]
spec-first session heartbeat  --id <id> [--json]
spec-first session unregister --id <id> [--json]
spec-first session list       [--json] [--include-stale]
```

`session list` 默认隐藏 stale（`last_heartbeat_at` 距今 > 24h）记录；
`--include-stale` 输出全部并标注 `stale: true`。

## Stale 判定

`last_heartbeat_at` 距系统当前时间 > 24h 视为 stale。CLI 不自动删除
stale 文件——清理由 LLM advisory 提示用户进行，避免脚本越过语义边界。

## Consumer 协议

合法 consumer：

- `using-spec-first` guide mode：substantial work 前 `session list`，
  active count > 1 时 advisory disclose
- 关键写入 skill（U1 落地后的 bootstrap、setup）：作为 fingerprint
  检测的辅助信号源
- 用户/agent 调试：`session list --include-stale` 排查 phantom session

非合法行为：

- 把 session 文件作为硬 lock 阻塞其他 session 启动
- 把 `session_id` 注入到 setup/runtime artifact 字段（违反
  light contract，超出 advisory 范畴；属于角色契约 12 节反对的反模式）
- 在 generated runtime 里读取该文件作 contract truth

## 失败模式

| reason_code | 触发 | 处理 |
|---|---|---|
| `session-already-registered` | 同 `session_id` 重复 register | CLI exit 1，由调用方决定换 id 或 unregister 旧记录 |
| `session-field-invalid` | advisory 字段不满足轻量边界，例如 `host_marker_path` 不是 repo-relative path，或 `scope_hint` 包含路径逃逸信号 | CLI exit 1，由调用方改用安全字段或省略该字段 |
| `session-not-found` | unregister/heartbeat 找不到对应 id | CLI exit 1，提示先 register |
| `session-schema-invalid` | 文件存在但内容不符 schema | CLI list 跳过损坏记录并标注；不自愈 |

## 与角色契约的对齐

- §4 light contract：schema 极简，只有 8 个字段，无嵌套
- §6.1 scripts 输出确定性事实：CLI 只做注册/读取/移除，不输出语义结论
- §6.2 LLM 决判断：是否 disclose、是否避让、是否 stale 清理由 LLM 决
- §12 反对中心化 gate：session 文件不是 lock；不存在时 spec-first 全
  workflow 完全静默
- §13 schema_version 演进：本 schema 用 `spec-first-session.v1`，未来
  扩展走 v2 增量字段
