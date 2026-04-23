# 高风险模块

> 来源: risk-signals.json（severity=high/medium）  
> 分析模式: Full | 生成时间: 2026-04-23

## 🔴 HIGH 风险

### `src/crg/parser.js`（1910 LOC）

- **风险类型**: 大文件 + 核心依赖集中
- **影响范围**: 所有 17 种语言的 CRG 图索引正确性
- **关键约束**:
  - tree-sitter 语言 grammar 版本需与 `package.json` 中精确锁定版本一致
  - 修改解析逻辑后必须运行 `npm run test:e2e:crg`
  - native module prebuilt 路径由 `bin/prune-native.js` 管理

---

## 🟡 MEDIUM 风险

### `src/crg/cli/envelope.js#makeEnvelope`（in_degree=19）

- **风险类型**: Hub 节点，输出 contract 破坏性
- **影响范围**: 所有 CRG 命令（detect-changes, review-context, context, flow, community 等）
- **注意**: `schema_version: "crg-cli/v1"` 是宿主消费方的硬期望

### `src/context-routing/profiles.js#normalizeStage`（in_degree=15）

- **风险类型**: Hub 节点
- **影响范围**: context-routing 全模块的 stage 路由决策
- **注意**: stage 值集合 `{plan, work, review, unknown}` 的变更需同步更新宿主工作流

### `src/crg/cli/open-db.js#openDb`（in_degree=14）

- **风险类型**: Hub 节点，SQLite 访问统一入口
- **影响范围**: 所有需要读写 CRG 图数据库的命令
- **注意**: better-sqlite3 为 optionalDependency，需容错处理模块缺失

### `src/cli/commands/doctor.js`（1211 LOC）

- **风险类型**: 大文件，双宿主状态检查逻辑集中
- **影响范围**: `spec-first doctor --claude/--codex` 宿主健康检查
- **注意**: 修改时需在两个宿主各自验证，避免 Claude/Codex 路径不一致

### `src/cli/plugin.js`（1116 LOC）

- **风险类型**: 大文件，插件清单治理核心
- **影响范围**: 哪些 skills/agents 下发到哪个宿主的 routing 决策
- **注意**: 必须与 `.claude-plugin/plugin.json` 和 `skills-governance.json` 保持一致

## 高风险区域修改检查清单

改动以下任一路径时，必须确认：

- [ ] `src/crg/parser.js` → 运行 `npm run test:e2e:crg`
- [ ] `src/crg/cli/envelope.js` → 确认 `tests/contracts/crg-cli-v1.test.js` 通过
- [ ] `src/context-routing/profiles.js` → 确认 `tests/unit/context-routing-evaluator.test.js` 通过
- [ ] `src/cli/plugin.js` → 运行 `npm run lint:skill-entrypoints`
- [ ] 任何源码改动 → 补充 `CHANGELOG.md`
