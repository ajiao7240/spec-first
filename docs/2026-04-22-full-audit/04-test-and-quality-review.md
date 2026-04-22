# 测试、质量与工程成熟度审查

## 实际执行结果

本次主线程实际运行并通过：

```bash
npm test
```

覆盖结果包含：

- `tests/unit`：120 个 test suites 全通过，645 个 tests 全通过
- `tests/smoke`：CLI 与 install-local smoke 通过
- `tests/integration`：verification gate 与五步闭环 E2E 通过
- `tests/e2e`：CRG all-commands 与 SQLite audit 通过

## 测试结构现状

### 事实层

| 层 | 当前作用 | 现状 |
| --- | --- | --- |
| `tests/unit` | contract、state、dry-run、doctor JSON、Stage-0、CRG、governance | 覆盖最广 |
| `tests/smoke` | 安装、本地 CLI、双宿主发布治理、tarball 安装 | 实用性高 |
| `tests/integration` | verification gate 接线、五步闭环组合 | 已接线 |
| `tests/e2e` | CRG 命令全量/SQLite 审计、spec-graph-bootstrap 主链 | 已接线 |
| `tests/contracts` | 合同层测试 | 当前未接线 |

### 判断层

- 测试不是摆设，整体工程成熟度偏高。
- 但“目录存在”不等于“会在 CI 或本地默认脚本中执行”，`tests/contracts` 是明确反例。

## 工程质量强项

### 事实层

- `init`/`clean` 有真实 `--dry-run`，并被 unit/smoke 双重验证。
- `init` 对 legacy state、runtime drift、invalid Claude settings 有失败前保护。
- `doctor --json` 输出是分层诊断，不是单一 PASS/FAIL。
- `release:publish` 先强制 `test:release`，再 `npm pack`，最后 `npm publish`。
- tarball 安装 smoke 真实检查了 postinstall 与环境行为。

### 判断层

- 这是“真实可运行的工程体系”，不是只靠 prompt 和文档维持秩序。

### 建议动作

- `应保留`

## 关键缺口

### 1. `doctor verified` 语义过强

#### 事实层

- `doctor` 的 `workflow_runnability=verified` 由 runtime 资产和 evidence 文件推断，不是对宿主入口的真实探测。

#### 判断层

- 诊断方向没错，但术语需要降强度，或者补真实 probe。

#### 建议动作

- `应强化`：增加可选 runnable probe
- `应轻量化`：调整术语

### 2. `tests/contracts` 未接线

#### 事实层

- `package.json` 的 `test:unit` 和 `test` 都未包含 `tests/contracts`。

#### 判断层

- 这是测试治理完整性的明确缺口。

#### 建议动作

- `应强化`

### 3. 发布 tarball 的未知依赖只 warning

#### 事实层

- `install-tarball.sh` 对未知 `tree-sitter-*` 只 warning。

#### 判断层

- 这会弱化发布前验证的约束力度。

#### 建议动作

- `应强化`

### 4. destructive rollback 缺故障注入测试

#### 事实层

- 代码中已有 rollback 备份与恢复实现。
- 现有测试偏重 dry-run、preview、失败前保护，尚未直接证明“写到一半失败时能恢复”。

#### 判断层

- 这是典型的“机制存在，但未被最关键方式证明”。

#### 建议动作

- `应强化`

### 5. integration/e2e 命名边界漂移

#### 事实层

- `test:integration` 会调用 `tests/integration/e2e.sh`，而该脚本又跨调用 `tests/e2e` 内脚本。

#### 判断层

- 不影响功能，但会增加维护心智负担。

#### 建议动作

- `应轻量化`

## 对被审文档的反馈

### 事实层

- `项目治理-agent.md` 强调“测试与可验证性审查”的方向是正确的。
- 但它没有显式区分：
  - 推断性验证
  - 真实运行探测
  - 已接线测试目录
  - 未接线测试目录

### 判断层

- 文档应强化测试审计口径，而不是默认“有测试目录即被执行”。

## 结论

- 当前工程质量可以打高分。
- 但若要把 `项目治理-agent.md` 升级为正式审计基线，必须先把上面的四个强缺口写进审计清单。
