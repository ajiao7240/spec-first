# Public Entrypoints

> 来源: fact-inventory.entrypoints (Full 模式，CRG flows zero_in_degree_calls)  
> 置信度: Inferred | 推断依据: crg-flows-zero-in-degree

## CLI 命令入口（用户可见）

| 入口文件 | Symbol | Criticality | 描述 |
|----------|--------|------------|------|
| `src/cli/index.js` | `runCli` | 0.712 | 包级 CLI 主入口，解析 process.argv 路由到子命令 |
| `src/cli/commands/stage0-context.js` | `runStage0Context` | 0.655 | stage0-context 命令：生成 Stage-0 LLM 上下文 JSON |

## CRG 子命令入口（`spec-first crg *`）

| 入口文件 | Symbol | Criticality | 描述 |
|----------|--------|------------|------|
| `src/crg/commands/detect-changes.js` | `run` | 0.737 | CRG detect-changes：基于 git diff 检测变更文件并评估风险 |
| `src/crg/cli/postprocess.js` | `run` | 0.735 | CRG postprocess：AST 结果入库写入 SQLite 图数据库 |
| `src/crg/commands/review-context.js` | `run` | 0.735 | CRG review-context：为 PR review 构建上下文包 |
| `src/crg/cli/context.js` | `run` | 0.728 | CRG context：输出 top flows/communities/hubs |

## Bootstrap 内部入口（非 CLI 用户直接调用）

| 入口文件 | Symbol | Criticality | 描述 |
|----------|--------|------------|------|
| `src/bootstrap-compiler/compile-machine-artifacts.js` | `compileMachineArtifacts` | 0.728 | Bootstrap 编译器主编排：协调 fact derivation、routing、verification |

## Hub 节点（高 in_degree，非入口但高影响）

修改以下节点会影响所有调用方：

- `src/crg/cli/envelope.js#makeEnvelope`（in_degree=19）：CRG 所有命令的输出 envelope 格式
- `src/context-routing/profiles.js#normalizeStage`（in_degree=15）：context-routing 的 stage 规范化
- `src/crg/cli/open-db.js#openDb`（in_degree=14）：CRG 所有数据库访问的统一入口
- `src/context-routing/entry-resolver.js#normalizeAbsolutePath`（in_degree=10）：路径规范化

## 宿主工作流入口（运行时资产，非源码）

安装后由 `spec-first init` 生成，用户通过以下宿主入口调用：
- Claude: `/spec:*` 系列（如 `/spec:graph-bootstrap`, `/spec:plan`, `/spec:work`）
- Codex: `$spec-*` 系列
