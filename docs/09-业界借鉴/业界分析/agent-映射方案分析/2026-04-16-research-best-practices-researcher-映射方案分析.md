# research/best-practices-researcher 映射方案分析

> Lifecycle: historical-input / external-reference. 本文保留历史 CRG/CE/ECC 方案、迁移或对比材料；其中 `src/crg`、`spec-first crg`、`graph.db`、`better-sqlite3`、`.claude-plugin`、`CRG Stage-0`、`ECC`、`compound-engineering-plugin`、命令数量和文件数量等旧口径可能已过期。当前 source of truth 以 `docs/archive-index.md`、`docs/README.md`、根目录 README、`docs/05-用户手册/`、`docs/contracts/`、`skills/`、`src/cli/`、`CHANGELOG.md`、`spec-mcp-setup` 和 `spec-graph-bootstrap` 为准。

## 1. 结论摘要

结论：`best-practices-researcher` 的 P1 修复已完成，当前已经消除了最关键的能力收窄问题。

本轮修复后：

- `Rails/Ruby` 常见映射已恢复 `dhh-rails-style`
- source attribution 已从模糊的 `The relevant skill recommends...` 恢复为显式的 `The <skill-name> skill recommends...`

当前剩余差异只包含两类 intentional divergence：

- `Documentation` 映射使用 `spec-compound` 而不是 `ce:compound`
- attribution 示例保留 `<skill-name>` 作为泛化占位模板，而不是写死 `dhh-rails-style`

## 2. 代码事实

### 2.1 对比文件

- 上游文件：`/Users/kuang/xiaobu/compound-engineering-plugin/plugins/compound-engineering/agents/research/best-practices-researcher.md`
- 当前文件：`/Users/kuang/xiaobu/spec-first/agents/research/best-practices-researcher.md`

### 2.2 当前实际差异

本轮修复后，静态 diff 只剩 3 处：

1. `Documentation` skill 映射
   - 上游：`ce:compound`
   - 当前：`spec-compound`

2. `Organize Discoveries` 示例
   - 上游：`From skill: dhh-rails-style`
   - 当前：`From skill: <skill-name>`

3. `Source Attribution` 示例
   - 上游：`The dhh-rails-style skill recommends...`
   - 当前：`The <skill-name> skill recommends...`

此前缺失的这一处已经修复：

- `Rails/Ruby → dhh-rails-style, andrew-kane-gem-writer, dspy-ruby`

### 2.3 当前仓库中的 skill 事实

当前仓库确实同时存在这 3 个 Ruby/Rails 相关 skill：

- `/Users/kuang/xiaobu/spec-first/.agents/skills/dhh-rails-style/SKILL.md`
- `/Users/kuang/xiaobu/spec-first/.agents/skills/andrew-kane-gem-writer/SKILL.md`
- `/Users/kuang/xiaobu/spec-first/.agents/skills/dspy-ruby/SKILL.md`

因此，恢复 `dhh-rails-style` 不是风格偏好，而是把 agent 的常见映射恢复到与仓库实际能力一致。

## 3. 上游实现解读

上游版本的核心思路是：

- 先用本地 curated skills 做高信任度发现
- 只有 skill 覆盖不足时，才转向外部研究

其中“Common mappings”表是第一层发现入口，不是示例注释。

## 4. 当前实现解读

当前版本经过修复后，已经保留了最有价值的 hybrid 形态：

- Ruby/Rails 映射完整性恢复
- 文档沉淀 skill 名称迁移到 `spec-compound`
- attribution 示例仍保留泛化模板，但要求显式写出真实 skill 名

这比修复前更好，也比直接原样回退上游更适合当前仓库。

## 5. 差异细节与影响

### 5.1 宏观层面

当前已不存在“Ruby/Rails curated discovery 被收窄”的问题，这是本轮最关键的修复点。

剩余差异的性质已经变化：

- `spec-compound` 是当前仓库真实 skill 标识，相比 slash command 更贴近运行时 discoverability
- `<skill-name>` 是模板泛化，不再是 attribution 弱化

### 5.2 微观层面

微观上，当前版本要求最终输出写成：

- `From skill: <skill-name>`
- `The <skill-name> skill recommends...`

这仍然要求点名真实 skill，因此可复核性保住了。

## 6. 最优解判断

最优解已经基本落地：**保留当前 hybrid 版本，不回退上游。**

判断依据：

1. `dhh-rails-style` 恢复后，能力收窄问题已消失
2. `spec-compound` 作为当前仓库真实 skill 标识必须保留
3. `<skill-name>` 占位模板在不弱化 attribution 的前提下，提高了复用性

## 7. 吸收建议 / 保留分叉建议

### 建议保留

- `Documentation → spec-compound, every-style-editor`
- `From skill: <skill-name>`
- `The <skill-name> skill recommends...`

### 当前结论

- 本轮 P1 修复已完成
- 当前剩余差异可视为 intentional divergence，不再构成能力缺口

### 审查边界

本文只基于 agent 文本、skill 调用链和现有测试契约做判断，未执行运行时测试。
