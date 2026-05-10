# research/issue-intelligence-analyst 映射方案分析

> Lifecycle: historical-input / external-reference. 本文保留历史 CRG/CE/ECC 方案、迁移或对比材料；其中 `src/crg`、`spec-first crg`、`graph.db`、`better-sqlite3`、`.claude-plugin`、`CRG Stage-0`、`ECC`、`compound-engineering-plugin`、命令数量和文件数量等旧口径可能已过期。当前 source of truth 以 `docs/archive-index.md`、`docs/README.md`、根目录 README、`docs/05-用户手册/`、`docs/contracts/`、`skills/`、`src/cli/`、`CHANGELOG.md`、`spec-mcp-setup` 和 `spec-graph-bootstrap` 为准。

## 1. 结论摘要

结论：当前版本已经正确承接上游能力，并进一步把 Integration Points 收口为中性表述，不存在需要回退的功能缺口。

上下游唯一差异是 Integration Points 中的调用方说明。当前已经从“`ce:ideate` -> `spec:ideate`”的迁移，进一步收口为 “the project's ideation workflow” 中性表述。它仍与当前仓库真实 skill 名、测试契约和 runtime transform 逻辑一致，但不再把 agent 文本绑定到某一个具体命令名。

## 2. 代码事实

### 2.1 对比文件

- 上游文件：`/Users/kuang/xiaobu/compound-engineering-plugin/plugins/compound-engineering/agents/research/issue-intelligence-analyst.md`
- 当前文件：`/Users/kuang/xiaobu/spec-first/agents/research/issue-intelligence-analyst.md`

### 2.2 实际差异

静态 diff 只有 1 处：

- 上游：`ce:ideate`
- 当前：`The project's ideation workflow`

其它内容保持一致，包括：

- GitHub issue 聚类的输出结构
- `gh` CLI + `--jq` 的工具使用约束
- 禁止脚本、禁止 pipe 的权限控制原则
- 主题统计、趋势、confidence、representative issues 的检查清单

### 2.3 当前仓库中的消费链

当前仓库里，`issue-intelligence-analyst` 的主消费链是明确的：

- `skills/spec-ideate/SKILL.md`：在检测到 issue-tracker intent 时，将它作为 Phase 1 的第三个并行 grounding agent
- `tests/unit/spec-ideate-contracts.test.js`：断言 source skill 中包含 `spec-first:research:issue-intelligence-analyst`
- 同一组 tests 还断言 runtime transform 后会转成宿主特定引用，而不会在 runtime 文本中残留 source namespace

因此，当前 agent 文本里的中性 ideation workflow 表述，不是任意改写，而是和真实控制面一致的收口。

## 3. 上游实现解读

上游版本把这个 agent 定位成 issue landscape analyst：

- 批量读取 issue
- 基于真实数据做主题聚类
- 输出 recurring themes、严重度、趋势与代表性 issue
- 为 ideation 或独立 issue 研究提供“用户在反复报告什么”的事实底座

它的核心设计重点不在产品名，而在“不要编造统计，不要用脚本滥处理 issue 数据”。

## 4. 当前实现解读

当前版本保留了上游的完整研究协议，只把 Integration Points 的入口名说明进一步收口为当前仓库可复用的 ideation workflow 描述。

这种调整让 agent 描述与当前 skill 树对齐，而没有改动其 GitHub issue 研究方法。

## 5. 差异细节与影响

### 5.1 宏观层面

宏观上，这是纯宿主适配之后的中性化收口，不是行为分叉。

当前仓库的 ideation workflow 明确使用 `spec-ideate`，并在 source / runtime 两侧分别维护 source namespace 与 host-specific transform。agent 文本如果继续保留 `ce:ideate`，反而会把当前控制面说错。

### 5.2 微观层面

微观上，影响只在“这个 agent 被谁调用”的说明文字：

- 保留上游写法会让调用链说明过时
- 采用当前写法则与 `spec-ideate` skill、测试和 runtime 适配保持一致
- 且不需要在未来再次改名时继续同步 agent 正文

对 issue 聚类本身没有任何算法级或结构级影响。

## 6. 最优解判断

最优解是：**保留当前 `spec-first` 版本，不做上游回退。**

判断依据：

1. 当前差异只涉及调用方说明文字
2. 当前仓库真实 skill 仍是 `spec-ideate`
3. 测试契约已经围绕 `spec-first:research:issue-intelligence-analyst` 和 runtime 适配建立
4. 没有任何代码事实表明上游多了一层当前仓库缺失的 issue intelligence 能力

## 7. 吸收建议 / 保留分叉建议

### 建议保留

- 保留当前 “project ideation workflow” 中性表述，继续与当前 ideation 控制面对齐

### 当前结论

- 本轮高频命名硬编码优化已完成

### 审查边界

本文只基于静态代码、skill 调用链和现有测试契约做判断，未执行运行时测试。
