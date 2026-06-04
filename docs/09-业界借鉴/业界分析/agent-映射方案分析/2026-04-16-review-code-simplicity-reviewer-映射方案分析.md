# review/code-simplicity-reviewer 映射方案分析

> Lifecycle: historical-input / external-reference. 本文保留历史 CRG/CE/ECC 方案、迁移或对比材料；其中 `src/crg`、`spec-first crg`、`graph.db`、`better-sqlite3`、`.claude-plugin`、`CRG Stage-0`、`ECC`、`compound-engineering-plugin`、命令数量和文件数量等旧口径可能已过期。当前 source of truth 以 `docs/archive-index.md`、`docs/README.md`、根目录 README、`docs/05-用户手册/`、`docs/contracts/`、`skills/`、`src/cli/`、`CHANGELOG.md`、`spec-mcp-setup` 和 `spec-graph-bootstrap` 为准。

## 1. 结论摘要

结论：当前版本已经是更优落点，并进一步把高频命名硬编码收口为中性模板，不建议回退到上游文本。

原因只有一个，但足够决定性：两端唯一代码差异不是行为逻辑，而是受保护产物说明已经从宿主特定命名进一步收口为“project workflow 下的长期活文档产物”中性模板。当前文本既保留了文档保护语义，又不再把 agent 绑定到某一个命令名。

## 2. 代码事实

### 2.1 对比文件

- 上游文件：`/Users/kuang/xiaobu/compound-engineering-plugin/plugins/compound-engineering/agents/review/code-simplicity-reviewer.md`
- 当前文件：`/Users/kuang/xiaobu/spec-first/agents/review/code-simplicity-reviewer.md`

### 2.2 实际 diff

两端只有 1 处增删改，`git diff --no-index --numstat` 结果为 `1 1`。

关键差异位于 “Apply YAGNI Rigorously” 段落：

- 上游写法：`docs/plans/*.md` / `docs/solutions/*.md` 是由 `/ce:plan` 创建、由 `/ce:work` 使用的 `compound-engineering` pipeline artifacts
- 当前写法：同一语义被替换为 “the project's workflow 维护的长期 planning / knowledge artifacts”

### 2.3 当前仓库中的消费链

当前 agent 并不是孤立文件，至少被以下当前代码消费：

- `skills/spec-compound/SKILL.md`
- `skills/orchestrating-swarms/SKILL.md`
- `skills/spec-code-review/references/persona-catalog.md`

这些消费点都已经使用 `spec-first:review:code-simplicity-reviewer` 或 `spec-*` 命名，而不是 `compound-engineering:*`。

## 3. 上游实现解读

上游版本把 `code-simplicity-reviewer` 定义为一个最终极简性审查 persona，核心职责非常稳定：

- 逐行质疑代码是否必要
- 识别复杂逻辑、重复、防御式冗余和过早抽象
- 以 YAGNI 为主轴提出删除或收缩建议
- 明确要求不要把 `docs/plans/*.md` 和 `docs/solutions/*.md` 误判为可删除噪音

也就是说，上游的真实“能力核心”不是某个产品名，而是“保护长期文档产物，不把 pipeline 产物误报为冗余”。

## 4. 当前实现解读

当前版本完整保留了上游能力核心，只对最后一条保护规则做了中性化收口。

这不是品牌替换层面的润色，而是为了同时满足两个目标：和当前仓库真实控制面保持一致，以及降低未来继续迁移命名时的维护成本。

## 5. 差异细节与影响

### 5.1 宏观层面

宏观上，这个 agent 的差异不属于能力漂移，而属于“工作流宿主名义迁移之后的中性化收口”。

换言之：

- 上游问题空间：保护 `compound-engineering` 流水线产物
- 当前问题空间：保护当前项目 workflow 下的长期活文档产物

两者解决的是同一个问题，但当前仓库必须绑定当前真实工作流名称。

### 5.2 微观层面

微观上，差异只影响 reviewer 在做“是否应该删除某些文档文件”时的上下文解释：

- 如果保留上游文案，agent 会把当前仓库的活文档解释为 `/ce:*` 产物
- 如果采用当前文案，agent 会把这些文档正确识别为当前 workflow 的长期活文档产物

这会直接影响 review 语义准确性，但不会改变 agent 的输出结构、分析框架和审核标准。

## 6. 最优解判断

基于当前代码，最优解是：**保留当前 `spec-first` 版本，不吸收上游文本回退。**

判断依据：

1. 当前仓库实际调用链已经全部迁移到 `spec-*` 与 `spec-first:*`
2. 当前 diff 没有暴露上游新增能力，只是把同一保护规则收口为更稳定的中性模板
3. 回退上游文本不会增强审查能力，只会降低当前仓库语义一致性

## 7. 吸收建议 / 保留分叉建议

### 建议

- 结论：当前实现无需继续吸收上游变更，维持现状即可。
- 保留分叉：应继续保留当前中性模板，这是当前仓库的 intentional divergence。

### 当前结论

- 本轮高频命名硬编码优化已完成

### 审查边界

本文只基于静态代码与调用链引用做判断，未执行运行时测试。
