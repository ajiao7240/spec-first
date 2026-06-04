# research/git-history-analyzer 映射方案分析

> Lifecycle: historical-input / external-reference. 本文保留历史 CRG/CE/ECC 方案、迁移或对比材料；其中 `src/crg`、`spec-first crg`、`graph.db`、`better-sqlite3`、`.claude-plugin`、`CRG Stage-0`、`ECC`、`compound-engineering-plugin`、命令数量和文件数量等旧口径可能已过期。当前 source of truth 以 `docs/archive-index.md`、`docs/README.md`、根目录 README、`docs/05-用户手册/`、`docs/contracts/`、`skills/`、`src/cli/`、`CHANGELOG.md`、`spec-mcp-setup` 和 `spec-graph-bootstrap` 为准。

## 1. 结论摘要

结论：当前版本已经进一步收口为更优落点，不建议回退到任何宿主特定写法。

原因很直接：上下游唯一差异仍然只在最后一条保护说明，但当前已从“宿主命名迁移”进一步收口为“项目 workflow 下的长期文档产物”中性表述。正文里的 git archaeology 方法、命令建议、输出结构、分析维度都保持一致。

## 2. 代码事实

### 2.1 对比文件

- 上游文件：`/Users/kuang/xiaobu/compound-engineering-plugin/plugins/compound-engineering/agents/research/git-history-analyzer.md`
- 当前文件：`/Users/kuang/xiaobu/spec-first/agents/research/git-history-analyzer.md`

### 2.2 实际差异

静态 diff 只有最后一段保护说明的 1 处改动：

- 上游：`docs/plans/` 与 `docs/solutions/` 是 `compound-engineering` pipeline artifacts，由 `/ce:plan` 创建
- 当前：同一语义改成 “the project's workflow 维护的长期 planning / knowledge artifacts”

除此之外，前 45 行的 agent 行为描述完全一致，包括：

- `git log --follow`
- `git blame -w -C -C -C`
- `git shortlog -sn`
- `git log -S"pattern"`
- 时间线、贡献者、历史问题、演化模式四类输出结构

### 2.3 当前仓库中的相关消费链

当前仓库至少有这些明确引用：

- `skills/spec-plan/references/deepening-workflow.md`：只有在历史成因明显缺失时，才补 dispatch `spec-first:research:git-history-analyzer`
- `skills/orchestrating-swarms/SKILL.md`：把它作为标准 code archaeology researcher

这说明该 agent 在当前体系中的职责仍然是“补历史上下文”，而不是独立产品能力分叉点。

## 3. 上游实现解读

上游版本的设计目标是把 `git` 当成代码考古层：

- 先看文件演化
- 再看代码来源
- 再看模式和贡献者
- 最后把这些历史事实整理成可用于当前决策的摘要

最后一条保护说明的真实目的，是防止它把 `docs/plans/` 和 `docs/solutions/` 误判成“可删噪音”或“没有业务价值的文档残留”。

## 4. 当前实现解读

当前版本完整保留了上游的考古方法论，并把被保护的文档产物说明进一步抽象成当前项目通用的中性模板。

这意味着 agent 在分析历史时，会把当前仓库的 plan / solution 文档识别为真实工作流产物，而不是遗留杂项，同时也不会在未来再次改名时继续同步一轮 `ce:* -> spec:* -> 其他前缀`。

## 5. 差异细节与影响

### 5.1 宏观层面

宏观上，这不是能力差异，而是“宿主名义迁移之后的中性化收口”：

- 上游保护的是上游自己的长期活文档
- 当前保护的是当前项目 workflow 下的长期活文档

两端解决的是同一个问题，只是指向的 workflow 名称不同。

### 5.2 微观层面

微观上，如果回退上游文本，会产生两个具体问题：

1. 如果保留宿主特定旧写法，agent 会引用一个本仓库已经不使用的 `/ce:plan`
2. reviewer / researcher 在解释 `docs/plans/` 与 `docs/solutions/` 时，也不再绑定到未来可能继续变化的产品名或命令名

这些问题不会让 agent 失去 git 分析能力，但会降低它在当前仓库里的语义准确度。

## 6. 最优解判断

最优解是：**保留当前 `spec-first` 版本，不做上游回退。**

判断依据：

1. 上下游差异只发生在保护说明的文案层
2. 当前中性模板既覆盖当前仓库语义，也减少后续重命名成本
3. 没有任何代码事实表明上游版本额外提供了新的 git 分析能力

## 7. 吸收建议 / 保留分叉建议

### 建议保留

- 保留当前 “project workflow 下的长期 planning / knowledge artifacts” 中性文案

### 当前结论

- 本轮高频命名硬编码优化已完成

### 审查边界

本文只基于静态代码和 skill 调用链做判断，未执行运行时测试。
