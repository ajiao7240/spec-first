# research/slack-researcher 映射方案分析

> Lifecycle: historical-input / external-reference. 本文保留历史 CRG/CE/ECC 方案、迁移或对比材料；其中 `src/crg`、`spec-first crg`、`graph.db`、`better-sqlite3`、`.claude-plugin`、`CRG Stage-0`、`ECC`、`compound-engineering-plugin`、命令数量和文件数量等旧口径可能已过期。当前 source of truth 以 `docs/archive-index.md`、`docs/README.md`、根目录 README、`docs/05-用户手册/`、`docs/contracts/`、`skills/`、`src/cli/`、`CHANGELOG.md`、`spec-mcp-setup` 和 `spec-graph-bootstrap` 为准。

## 1. 结论摘要

结论：`slack-researcher` 在当前仓库与上游之间是能力等价，不是能力漂移；差异只在模型选择策略。

上游把 frontmatter 固定为 `model: sonnet`，当前改为 `model: inherit`。正文里的 Slack MCP 前置检查、搜索策略、thread/channel 读取、workspace 识别、research-value 分级、隐私和 untrusted input 处理规则都没有变化。

结合当前 `spec-slack-research` skill 与测试契约，`model: inherit` 是有意保留的控制面策略，不应回退。

## 2. 代码事实

### 2.1 对比文件

- 上游文件：`/Users/kuang/xiaobu/compound-engineering-plugin/plugins/compound-engineering/agents/research/slack-researcher.md`
- 当前文件：`/Users/kuang/xiaobu/spec-first/agents/research/slack-researcher.md`

### 2.2 实际差异

静态 diff 只有 frontmatter 一处：

- 上游：`model: sonnet`
- 当前：`model: inherit`

正文其余内容一致，包括：

- Slack MCP availability probe
- `slack_search_public_and_private`
- 2-3 次 targeted search 策略
- workspace subdomain 提取
- 3-5 次 thread read 上限
- channel hint 的条件读取
- `Research value: high/moderate/low/none`
- untrusted Slack message handling
- 不搜索 DMs 的边界

### 2.3 当前仓库中的消费链

当前仓库的正式入口是：

- `skills/spec-slack-research/SKILL.md`：dispatch `spec-first:research:slack-researcher`，并明确“omit the mode parameter so the user's configured permission settings apply”

测试契约还把 `inherit` 固化成当前设计的一部分：

- `tests/unit/spec-slack-research-contracts.test.js` 断言 agent 包含 `model: inherit`
- 同一测试还断言 source / runtime transform 都使用当前宿主对应的 `slack-researcher` 引用

## 3. 上游实现解读

上游版本把 `slack-researcher` 设计成组织知识研究 agent：

- 先确认 Slack MCP 可用
- 再做主题搜索与 thread 读取
- 最后输出综合 digest，而不是消息列表

它把模型固定为 `sonnet`，反映的是一种“为研究类 agent 直接钉住模型”的治理选择。

## 4. 当前实现解读

当前版本完全保留了上游的 Slack 研究协议，只把模型策略改成了继承调用方：

- agent 本身不强绑固定模型
- 由调用它的 workflow / 用户配置决定最终模型

考虑到 `spec-slack-research` skill 明确要求复用用户配置，这种 `inherit` 与当前控制面是配套的。

## 5. 差异细节与影响

### 5.1 宏观层面

宏观上，这个差异属于“模型治理策略”，不是“研究流程差异”。

- 上游偏向固定模型以求稳定
- 当前偏向复用调用方模型配置，以减少 agent 级硬编码

### 5.2 微观层面

微观上，它只影响运行时最终选用什么模型，不影响：

- 会不会 probe Slack MCP
- 会不会读 thread / channel
- 输出是否包含 workspace identity 与 research value
- 如何处理 untrusted input 和 privacy boundary

因此，这里不能说当前仓库“少了 Slack research 能力”。

## 6. 最优解判断

最优解是：**保留当前 `model: inherit` 分叉。**

判断依据：

1. `spec-slack-research` 明确要求复用调用方权限与配置
2. 测试契约已经把 `model: inherit` 固化
3. 没有任何代码事实表明该 agent 依赖固定 `sonnet` 才能成立
4. 正文研究协议完全一致，因此不存在功能缺口

## 7. 吸收建议 / 保留分叉建议

### 建议保留

- 保留 `model: inherit`
- 保留当前 `spec-slack-research` -> `slack-researcher` 的调用关系

### 不建议回退

- 不建议仅因为上游写死了 `sonnet` 就回退当前 frontmatter；这会把当前控制面从“由调用方统一决定模型”重新改回“agent 单点硬编码模型”

### 审查边界

本文只基于静态代码、skill 调用链和测试契约做判断，未执行运行时测试。
