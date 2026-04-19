---
title: "fix: Harden rollback restore and telemetry write reliability"
type: fix
status: completed
created: 2026-04-18
author: 矿工
depth: lightweight
---

# fix: Harden rollback restore and telemetry write reliability

## Problem Frame

两处代码在 restore 路径和 telemetry 写入路径上存在静默失败风险，会让调用方对操作结果产生错误假设：

1. **rollback.js L67/L99**：restore 操作先用 `force: true` 删除目标目录，再从 backup 复制。若目录因权限问题删除失败，`force: true` 静默忽略，`copyDirectory` 随即在未清空的目录上叠写，导致 restore 不完整却无任何错误信号。
2. **telemetry.js L64-66**：`mkdirSync` 和 `writeFileSync` 无 try/catch，磁盘满或权限拒绝时抛出未捕获异常，中断工作流主流程。此外，文件名仅用 `generatedAt.replace(/[:.]/g, '-')`，workspace 并发场景（多 child 同时完成且 `generatedAt` 相同）会产生文件名碰撞。

## Scope

### In Scope

- `src/bootstrap-compiler/rollback.js`：修复 L67、L99 两处 restore-before-copy rmSync 错误处理
- `src/context-routing/telemetry.js`：mkdirSync + writeFileSync 包裹 try/catch；文件名加唯一后缀防碰撞
- `tests/unit/spec-graph-bootstrap-compiler.test.js`：补充 restore 权限失败场景测试
- `tests/unit/workflow-telemetry.test.js`：补充写入失败降级测试

### Out of Scope

- L74、L111（cleanup 类 rmSync）：cleanup 的 `force: true` 在清理 backup 临时目录时行为合理，不修改
- telemetry schema 字段变更
- 其他模块的文件操作加固（非本轮范围）

## Requirements Trace

- R1. restore 操作若因权限导致目标目录删除失败，必须向调用方抛出错误，不得静默继续。
- R2. restore 操作若目标目录不存在（`ENOENT`），正常继续（已删或从未创建均为合法前提态）。
- R3. telemetry 写入失败必须降级为 warning（`stderr.write`），不得中断主工作流。
- R4. telemetry 文件名在 workspace 并发场景下必须唯一，不得产生覆盖。
- R5. `recordWorkflowTelemetry` 写入失败时仍返回 `{ filePath: null, record }`，不破坏现有调用方接口（3 处调用均不使用返回值，但保持签名稳定）。

## Code Facts

### rollback.js 当前代码（问题行）

```js
// restoreBootstrapBackup L67 — restore 前删除 contextDir
fs.rmSync(contextDir, { recursive: true, force: true });  // ← force:true 隐藏 EACCES
copyDirectory(backupDir, contextDir);

// restoreBatchBackup L99 — restore 前删除 sourceDir
fs.rmSync(entry.sourceDir, { recursive: true, force: true });  // ← 同上
```

**对比**：L74、L111 是 cleanup 操作（删 backupDir），`force: true` 无害，保持不变。

### telemetry.js 当前代码（问题行）

```js
fs.mkdirSync(dir, { recursive: true });                              // L64，无保护
const filePath = path.join(dir, `${generatedAt.replace(/[:.]/g, '-')}.json`);  // L65，无唯一后缀
fs.writeFileSync(filePath, JSON.stringify(record, null, 2));         // L66，无保护
return { filePath, record };
```

**调用方**：`run-bootstrap.js:373`、`run-bootstrap.js:499`、`stage0-context.js:395`，均不使用返回的 `filePath`。

## Existing Patterns

本仓库已有的相同 ENOENT 容忍模式（可直接参考）：

```js
// src/crg/incremental.js computeFileSHA
try {
  const bytes = fs.readFileSync(absolutePath);
  ...
} catch {
  return null;
}

// src/cli/state.js readState
try {
  rawManagedState = tryReadRawManagedState(projectRoot, adapter);
} catch (error) {
  ...
}
```

## Implementation Units

### Unit 1 — rollback.js restore rmSync 区分 ENOENT vs 权限错误

**文件**：`src/bootstrap-compiler/rollback.js`

**改动**：将 L67 和 L99 的 `fs.rmSync(..., { force: true })` 替换为 ENOENT 容忍、其他错误上报的模式：

```js
// 替换前
fs.rmSync(contextDir, { recursive: true, force: true });

// 替换后（方向性伪代码，非实现规范）
try {
  fs.rmSync(contextDir, { recursive: true });
} catch (err) {
  if (err.code !== 'ENOENT') throw err;
}
```

L99（`restoreBatchBackup`）对 `entry.sourceDir` 做相同改动。

**不修改**：L74（`removeBootstrapBackup`）、L111（`removeBatchBackup`）保留 `force: true`。

**测试文件**：`tests/unit/spec-graph-bootstrap-compiler.test.js`

测试场景：
- `restoreBootstrapBackup`：contextDir 不存在（`ENOENT`）时 restore 成功完成
- `restoreBootstrapBackup`：contextDir 删除失败（模拟非 ENOENT 错误）时函数抛出，不执行 copyDirectory
- `restoreBatchBackup`：sourceDir 不存在时 entry 正常跳过
- `restoreBatchBackup`：sourceDir 删除失败时函数抛出

### Unit 2 — telemetry.js 写入降级 + 文件名唯一化

**文件**：`src/context-routing/telemetry.js`

**改动 A**：L64-66 包裹 try/catch，写入失败降级 warning，返回 `{ filePath: null, record }`：

```js
// 方向性伪代码
try {
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${stamp}-${uniqueSuffix}.json`);
  fs.writeFileSync(filePath, JSON.stringify(record, null, 2));
  return { filePath, record };
} catch (err) {
  process.stderr.write(`[spec-first] telemetry write failed: ${err.message}\n`);
  return { filePath: null, record };
}
```

**改动 B**：文件名加唯一后缀防碰撞。可用 `Date.now().toString(36)` 生成 4-6 位短串追加到 ISO 时间戳后，保留现有 timestamp 前缀（便于按时间排序）。

**测试文件**：`tests/unit/workflow-telemetry.test.js`

测试场景：
- 写入目录不可写时，`recordWorkflowTelemetry` 不抛出，返回 `{ filePath: null, record }`
- 并发调用（同 `generatedAt`、同 slug）产生不同文件名，不相互覆盖
- 正常调用：返回 `filePath` 不为 null，文件内容与 record 一致

## Sequencing

Unit 1 和 Unit 2 相互独立，可并行实施或任意顺序。建议先 Unit 1（正确性更高），再 Unit 2（降级保障）。

## Verification Matrix

| 验证类型 | 命令 | 覆盖目标 |
|---|---|---|
| 单元测试 | `npm run test:jest` | Unit 1 + Unit 2 新增场景 |
| Smoke 测试 | `npm run test:smoke` | CLI 主流程未受影响 |
| 集成测试 | `npm run test:integration` | bootstrap 主链端到端 |

## Execution Note

- 两个 Unit 均为纯内部模块改动，不涉及 CLI flags、exported API、schema 变更。
- rollback.js L74/L111 有意保持 `force: true`，不要误改。
- telemetry 文件名改动不影响现有 telemetry 读取逻辑（无已知消费方按文件名检索）。
- Starting point：`src/bootstrap-compiler/rollback.js` L67 是最小改动入口，先改这一行验证测试，再扩展到 L99 和 telemetry。
