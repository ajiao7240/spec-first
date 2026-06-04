# review/project-standards-reviewer 映射方案分析

> Lifecycle: historical-input / external-reference. 本文保留历史 CRG/CE/ECC 方案、迁移或对比材料；其中 `src/crg`、`spec-first crg`、`graph.db`、`better-sqlite3`、`.claude-plugin`、`CRG Stage-0`、`ECC`、`compound-engineering-plugin`、命令数量和文件数量等旧口径可能已过期。当前 source of truth 以 `docs/archive-index.md`、`docs/README.md`、根目录 README、`docs/05-用户手册/`、`docs/contracts/`、`skills/`、`src/cli/`、`CHANGELOG.md`、`spec-mcp-setup` 和 `spec-graph-bootstrap` 为准。

## 1. 结论摘要

结论：当前版本是更优解，应保留当前实现，不建议回退上游文案。

这个 agent 的差异仍然不是能力缺失，而是“标准发现路径”和“fully-qualified agent name 示例”已经从宿主命名迁移进一步收口为中性模板。当前仓库的 standards 文件、skill namespace 和 smoke/unit 测试都围绕当前产品边界组织，继续写死具体插件路径与 namespace 只会让 reviewer 在下一次命名迁移时再改一轮。

## 2. 代码事实

### 2.1 对比文件

- 上游文件：`/Users/kuang/xiaobu/compound-engineering-plugin/plugins/compound-engineering/agents/review/project-standards-reviewer.md`
- 当前文件：`/Users/kuang/xiaobu/spec-first/agents/review/project-standards-reviewer.md`

### 2.2 实际 diff

两端只有 2 处文本差异，`git diff --no-index --numstat` 结果为 `2 2`。

关键差异只有两类：

1. standards 祖先目录示例
   - 上游：`plugins/compound-engineering/AGENTS.md`
   - 当前：`A standards file in a parent directory governs all changes under that subtree.`
2. fully-qualified agent name 示例
   - 上游：`compound-engineering:research:learnings-researcher`
   - 当前：`the project's fully qualified agent name`

### 2.3 当前仓库中的消费链

当前仓库至少有以下位置直接消费这一 agent 或其 namespace：

- `skills/spec-code-review/SKILL.md`
- `skills/spec-code-review/references/persona-catalog.md`
- `tests/smoke/cli.sh`

这些消费点都已经以 `spec-first:review:project-standards-reviewer` 为准。

## 3. 上游实现解读

上游 `project-standards-reviewer` 的定位很清晰：它不是做通用 best practice review，而是严格按项目自身 `CLAUDE.md` / `AGENTS.md` 审查。

它的核心能力包括：

- 发现适用的 standards files
- 检查 YAML frontmatter、引用方式、命名、可移植性和工具使用约束
- 只对 standards 明确规定的内容提出 findings
- 输出必须引用具体规则与具体违规点

因此它的真实核心是“标准驱动审查”，而不是某个固定插件名。

## 4. 当前实现解读

当前版本保持了上游的整个审查框架，只改了两个具体示例：

- 用 parent-directory subtree 规则替换上游目录示例
- 用 project-qualified agent name 替换上游 canonical name 示例

这两个改动都直连当前仓库真实治理边界，同时不再把 agent 文本绑死在某个具体插件路径或 namespace。

## 5. 差异细节与影响

### 5.1 宏观层面

宏观上，这个差异属于“治理边界与命名空间适配之后的中性化收口”。

`project-standards-reviewer` 的工作结果依赖它如何理解：

- 哪些 standards 文件对当前 diff 生效
- 什么样的 agent name 才是 fully qualified

这两点如果示例仍停留在上游命名，会把当前仓库的治理边界解释错。

### 5.2 微观层面

微观上，两处差异都出现在说明文字里，而不在审查流程里：

- 没有改变 JSON 输出格式
- 没有改变 finding 证据要求
- 没有改变 standards discovery 的步骤顺序

因此这里不存在“上游更强、当前更弱”的问题，只有“示例是否对当前仓库真实有效”的问题。

## 6. 最优解判断

基于当前项目代码，最优解是：**保留当前 `spec-first` 版本。**

理由：

1. 当前调用点、测试和文档全部以 `spec-first:*` 为 canonical namespace
2. 当前治理边界示例必须指向当前仓库实际目录，而不是上游目录
3. 回退到上游示例不会增加审查能力，只会让 reviewer 在当前仓库中举错例子

## 7. 吸收建议 / 保留分叉建议

### 建议

- 当前实现应保留，不需要从上游再吸收任何文本回退。
- 当前写法已经把 subtree / project-qualified wording 收口为更稳定模板。

### 当前结论

- 本轮高频命名硬编码优化已完成

### 审查边界

本文只基于静态代码、skill 引用和测试引用做判断，未执行运行时测试。
