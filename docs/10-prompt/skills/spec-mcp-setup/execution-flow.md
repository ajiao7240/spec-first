# mcp-setup 执行流程

> 更新于 2026-04-23

## 总览

```text
/spec:mcp-setup [quick|custom]
  ↓
Phase 1: check-deps.*
  - 检测 node / uv / jq
  - 缺依赖则先补依赖，否则停止后续安装
  ↓
Phase 2: detect-tools.*
  - 识别当前宿主
  - 读取当前宿主配置
  - 产出 readiness facts：host config / project bootstrap / CRG / next_actions[]
  ↓
Phase 3: install-mcp.*
  - 对 installation.kind = warmup 的工具先执行 metadata 中声明的 warmup command
  - configure-host.* 原子写入宿主配置（backup + lock + verify + rollback）
  - Serena 额外执行 activate-serena.*
  ↓
Phase 4: verify-tools.*
  - 重新读取 readiness facts
  - 原子写入当前宿主的 readiness ledger v1
```

## 关键数据流

```text
mcp-tools.json
  ├─► detect-tools.*
  ├─► install-mcp.*
  │    ├─► configure-host.*
  │    └─► activate-serena.*
  └─► verify-tools.*
         └─► host-setup.json (v1)
```

## Serena bootstrap 判定

- `.serena/project.yml` 只表示 project metadata 已存在
- `.serena/index-ready.json` 表示最近一次 Serena index 成功完成
- `tools.serena.project_status` 的语义：
  - `pending`：缺少 `.serena/project.yml`
  - `failed`：有 `.serena/project.yml`，但缺少 `.serena/index-ready.json`
  - `ready`：`.serena/project.yml` 与 `.serena/index-ready.json` 都存在

不要把 `.serena/project.yml` 单独视为 bootstrap 完成。

## readiness ledger v1 关键字段

- `overall_status`
- `baseline_ready`
- `tools.<tool>.dependency_status`
- `tools.<tool>.host_config_status`
- `tools.<tool>.project_status`
- `tools.<tool>.next_action`
- `crg.cli_status`
- `crg.native_modules_status`
- `next_actions[]`

其中 `next_actions[]` 必须聚合：
- repo 级 blocker（例如 CRG CLI / native modules）
- 每个 tool 的非空 `next_action`
- 去重后的 deterministic next steps

## 相关文件

| 文件 | 职责 |
|------|------|
| `skills/spec-mcp-setup/mcp-tools.json` | MCP tool metadata 单一 machine truth |
| `skills/spec-mcp-setup/scripts/check-deps.*` | 检测 node / uv / jq 依赖 |
| `skills/spec-mcp-setup/scripts/detect-tools.*` | 生成 host + repo readiness facts |
| `skills/spec-mcp-setup/scripts/install-mcp.*` | 执行 warmup / host config / Serena bootstrap |
| `skills/spec-mcp-setup/scripts/configure-host.*` | 原子写入宿主配置并在失败时回滚 |
| `skills/spec-mcp-setup/scripts/activate-serena.*` | 写入 Serena project metadata 并在 index 成功后落 ready marker |
| `skills/spec-mcp-setup/scripts/verify-tools.*` | 写入当前宿主的 readiness ledger v1 |
