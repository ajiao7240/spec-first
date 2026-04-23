# 测试面地图

> 来源: test-surface.json + fact-inventory.testing_surface  
> 分析模式: Full | 生成时间: 2026-04-23

## 测试层次总览

| 类型 | 数量 | 路径 | 运行命令 |
|------|------|------|----------|
| Jest 单测 | 114 文件 | `tests/unit/*.test.js` | `npm run test:unit` |
| Shell 单测 | 4 文件 | `tests/unit/*.sh` | `npm run test:unit` |
| 集成测试 | 2 文件 | `tests/integration/` | `npm run test:integration` |
| E2E 测试 | 2 文件 | `tests/e2e/` | `npm run test:e2e:crg` |
| 烟雾测试 | 4 文件 | `tests/smoke/` | `npm run test:smoke` |

## 关键测试文件 → 被测模块映射

### CRG 核心

| 测试文件 | 被测模块 | 类型 |
|----------|----------|------|
| `tests/unit/crg-changes.test.js` | `src/crg/changes.js` | unit |
| `tests/unit/crg-analyze.test.js` | `src/crg/analyze.js` | unit |
| `tests/unit/crg-build-cli.test.js` | `src/crg/cli/build.js` | unit |
| `tests/unit/crg-chunking.test.js` | `src/crg/chunking.js` | unit |
| `tests/unit/crg-bfs-queue-source.test.js` | `src/crg/flows.js` | unit |
| `tests/unit/crg-characterization.test.js` | `src/crg/` | unit |
| `tests/e2e/crg-all-commands.sh` | `src/crg/` (全命令) | e2e |
| `tests/e2e/crg-sqlite-audit.sh` | `src/crg/migrations.js` | e2e |

### Bootstrap & Context Routing

| 测试文件 | 被测模块 | 类型 |
|----------|----------|------|
| `tests/unit/context-routing-evaluator.test.js` | `src/context-routing/evaluator.js` | unit |
| `tests/unit/change-surface.test.js` | `src/context-routing/change-surface.js` | unit |
| `tests/unit/verification-gate-state.test.js` | `src/context-routing/verification-gate-state.js` | unit |
| `tests/integration/verification-gate.integration.test.js` | `src/context-routing/` | integration |

### CLI & 治理合规

| 测试文件 | 类型 |
|----------|------|
| `tests/unit/init-dry-run.test.js` | unit (init 命令) |
| `tests/unit/clean-dry-run.test.js` | unit (clean 命令) |
| `tests/unit/asset-consistency.test.js` | unit (资产一致性) |
| `tests/unit/dual-host-governance-contracts.test.js` | unit (双宿主治理) |
| `tests/smoke/cli.sh` | integration (CLI 主路径) |

## 覆盖缺口（Coverage Gaps）

### 🔴 HIGH：`src/crg/changes.js#detectChanges`

`detectChanges` 是 detect-changes 和 review-context 两条高 criticality 流的共享核心，但 CRG `tests_for` 查询未发现直接测试映射。
- `tests/unit/crg-changes.test.js` 存在，但推断测试的是更细粒度函数而非 `detectChanges` 整体
- **建议**：补充 `detectChanges` 的集成级测试用例

### 🔴 HIGH：`src/crg/cli/envelope.js#makeEnvelope`

hub 节点（in_degree=19），所有 CRG 命令输出契约均通过此函数，无直接测试映射。
- `tests/contracts/crg-cli-v1.test.js` 可能覆盖 envelope 输出格式，但需确认
- **建议**：确认 crg-cli-v1 合约测试是否断言 `schema_version` 和 `degraded` 字段

### 🟡 MEDIUM：`src/crg/cli/open-db.js#openDb`

hub 节点（in_degree=14），SQLite 连接失败时所有 CRG 命令均会失败，无直接测试映射。
- better-sqlite3 optional dependency 的缺失容错路径需要专项测试
- **建议**：在 `tests/unit/crg-build-cli.test.js` 中补充 better-sqlite3 缺失场景

## 测试运行顺序（按 npm test 链路）

```
npm test
  ├─ npm run test:unit    (jest + shell unit tests)
  ├─ npm run test:smoke   (install-local.sh + cli.sh)
  ├─ npm run test:integration  (verification-gate + e2e.sh)
  └─ npm run test:e2e:crg  (crg-all-commands.sh + crg-sqlite-audit.sh)
```
