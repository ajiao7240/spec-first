# spec-doc-review/product-lens-reviewer 映射方案分析

> Lifecycle: historical-input / external-reference. 本文保留历史 CRG/CE/ECC 方案、迁移或对比材料；其中 `src/crg`、`spec-first crg`、`graph.db`、`better-sqlite3`、`.claude-plugin`、`CRG Stage-0`、`ECC`、`compound-engineering-plugin`、命令数量和文件数量等旧口径可能已过期。当前 source of truth 以 `docs/archive-index.md`、`docs/README.md`、根目录 README、`docs/05-用户手册/`、`docs/contracts/`、`skills/`、`src/cli/`、`CHANGELOG.md`、`spec-mcp-setup` 和 `spec-graph-bootstrap` 为准。

## 1. 结论摘要

结论：`product-lens-reviewer` 的 P1 修复已完成，当前 `spec-first` 版本已与上游对齐。

本轮修复恢复了上游的两块主体能力：

- `Product context`
- `Strategic consequences`

同时保留了当前仓库既有的 `model: inherit`；而上游同一文件当前也使用 `model: inherit`，因此这里已经不存在模型策略分叉。

## 2. 代码事实

### 2.1 对比文件

- 上游文件：`/Users/kuang/xiaobu/compound-engineering-plugin/plugins/compound-engineering/agents/spec-doc-review/product-lens-reviewer.md`
- 当前文件：`/Users/kuang/xiaobu/spec-first/agents/spec-doc-review/product-lens-reviewer.md`

### 2.2 当前差异状态

本轮修复后，对这两个文件执行静态 `diff -u`，结果为空。

也就是说，当前 `product-lens-reviewer` 已恢复：

- frontmatter 中更完整的职责描述
- `## Product context`
- `### 2. Strategic consequences`
- `Identity impact`
- `Adoption dynamics`
- `Opportunity cost`
- `Compounding direction`

### 2.3 宿主 skill 核对

当前仓库的 [spec-doc-review/SKILL.md](/Users/kuang/xiaobu/spec-first/skills/spec-doc-review/SKILL.md) 仍保留更强的 product-lens 激活规则，包括：

- `premise claims`
- `strategic weight`
- domain-agnostic 用户范围
- `Opportunity cost implications`

因此本轮代码修复没有出现“agent 正文已升级，但 skill 触发规则仍明显落后”的问题。

## 3. 上游实现解读

上游版本把 `product-lens-reviewer` 定位为泛产品语境下的战略 reviewer，而不只是传统用户功能评审者。

它的关键结构是：

- 先识别 product context
- 再分析二阶战略后果
- 最后再看 alternatives、goal-requirement alignment 和 prioritization coherence

这套结构特别适合 `spec-first` 这类同时覆盖 internal tooling、developer workflow 与 external-facing DX 的项目。

## 4. 当前实现解读

当前版本在本轮修复前，缺少上游的 `Product context` 与完整的 `Strategic consequences`；修复后，已经恢复为与上游一致的分析框架。

当前 skill 侧没有再需要同步的显著缺口，因此这一条已经从“有实质差异”收敛为“已完成对齐”。

## 5. 差异细节与影响

当前代码状态下，这个条目已无剩余正文差异。

它的直接影响是：

- `spec-doc-review` 在产品维度的审查能力恢复到上游完整水平
- 对 internal / external / hybrid 产品语境的判断不再缺失
- 战略后果审查从单点 trajectory 恢复为多维度分析

## 6. 最优解判断

最优解已经落地：**当前 `spec-first` 版本与上游对齐，且无需额外保留分叉。**

## 7. 吸收建议 / 保留分叉建议

### 当前结论

- 无需继续吸收；本轮目标已完成
- 无需额外保留分叉；当前与上游一致

### 审查边界

本文只基于静态代码对比与当前 skill 调用链核对做判断，未执行运行时测试。
