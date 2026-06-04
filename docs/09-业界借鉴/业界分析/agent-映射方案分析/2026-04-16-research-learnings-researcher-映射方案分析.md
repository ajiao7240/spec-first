# research/learnings-researcher 映射方案分析

> Lifecycle: historical-input / external-reference. 本文保留历史 CRG/CE/ECC 方案、迁移或对比材料；其中 `src/crg`、`spec-first crg`、`graph.db`、`better-sqlite3`、`.claude-plugin`、`CRG Stage-0`、`ECC`、`compound-engineering-plugin`、命令数量和文件数量等旧口径可能已过期。当前 source of truth 以 `docs/archive-index.md`、`docs/README.md`、根目录 README、`docs/05-用户手册/`、`docs/contracts/`、`skills/`、`src/cli/`、`CHANGELOG.md`、`spec-mcp-setup` 和 `spec-graph-bootstrap` 为准。

## 1. 结论摘要

结论：当前 `spec-first` 版本明显优于上游，且差异不是简单命名迁移，而是为了适配当前仓库 `docs/solutions/` 双轨 schema 做的必要改造。

其中有两点是决定性的：

1. 当前版本把检索逻辑从“偏 bug-track 的固定字段假设”改成了能消费 knowledge-track 的 `applies_when`
2. 当前版本把 `critical-patterns.md` 从“无条件必须读取”改成“存在才读取，缺失不报错”

这两点都能被当前仓库代码事实直接支撑，因此这里不应回退上游。

## 2. 代码事实

### 2.1 对比文件

- 上游文件：`/Users/kuang/xiaobu/compound-engineering-plugin/plugins/compound-engineering/agents/research/learnings-researcher.md`
- 当前文件：`/Users/kuang/xiaobu/spec-first/agents/research/learnings-researcher.md`

### 2.2 实际差异

当前版本相对上游至少有这些实质改动：

1. Step 3b 从 `Always Check Critical Patterns` 改成 `Check Critical Patterns When Present`
2. 明确声明：
   - 若 `docs/solutions/patterns/critical-patterns.md` 存在，则读取
   - 若不存在，记录“本仓库没有 critical patterns 文件”并继续
3. frontmatter 提取字段新增 `applies_when`
4. `symptoms` / `root_cause` 的描述从 bug-track 固定字段，放宽为“存在时使用”
5. relevance scoring 新增 knowledge-track 场景下的 `applies_when`
6. schema reference 从上游固定的 `ce-compound` 源路径，收口成 “current project's compound documentation schema references” 中性表述
7. Integration Points 从 `/ce:plan` / `/spec:plan` 的命令名，收口成 “The project's planning workflow”
8. 输出格式与 DO/DON'T 规则同步更新为“critical patterns 可选”

### 2.3 当前仓库中的直接证据

当前仓库没有 `docs/solutions/patterns/critical-patterns.md`：

- 目录 `docs/solutions/` 当前可见子目录只有 `developer-experience`、`logic-errors`、`workflow-issues`
- 静态文件检查结果显示 `docs/solutions/patterns/critical-patterns.md` 缺失

当前仓库的测试契约还明确把这种缺失视为正常情况：

- `tests/unit/spec-compound-contracts.test.js` 断言 `learnings-researcher` 必须包含
  - `If docs/solutions/patterns/critical-patterns.md exists`
  - `Missing this file is not an error`
  - `applies_when`

同一个测试文件还断言 `skills/spec-compound/references/schema.yaml` 与模板已经是 dual-track aware，并包含 `knowledge` 与 `applies_when`。

### 2.4 当前仓库中的消费链

`learnings-researcher` 在当前仓库是核心 research agent，而不是边缘补充：

- `skills/spec-plan/SKILL.md`
- `skills/spec-code-review/SKILL.md`
- `skills/spec-brainstorm/SKILL.md`
- `skills/spec-ideate/SKILL.md`
- `skills/spec-optimize/SKILL.md`

这意味着如果这个 agent 继续保留上游的旧假设，影响的不只是一个 skill，而是 planning / review / brainstorm / ideate / optimize 的公共知识检索层。

## 3. 上游实现解读

上游版本的设计假设是：

- `docs/solutions/` 主要按 bug/problem 维度组织
- `symptoms`、`root_cause` 等字段可以作为稳定的相关性信号
- `critical-patterns.md` 是长期存在且必须读取的全局高优先级文件

在这种 schema 假设下，上游写法是自洽的：先 grep，后读 frontmatter，再用 bug-track 特征打分。

## 4. 当前实现解读

当前版本显然是在对接已经变化后的 `spec-first` knowledge store 合约：

- `spec-compound` 已经引入 bug/knowledge 双轨 schema
- `learnings-researcher` 因而需要理解 `applies_when`
- `critical-patterns.md` 在当前仓库并不存在，所以必须 graceful skip
- schema reference 和 integration point 进一步收口为 project-neutral wording，避免继续写死 compound skill 路径或 planning command 名

也就是说，当前版本不是随意分叉，而是在适配当前仓库真实的数据合同和消费合同。

## 5. 差异细节与影响

### 5.1 宏观层面

宏观上，这个 agent 是 `spec-first` 知识复用链路的入口。如果它继续使用上游旧假设，会出现两类系统性问题：

1. **知识检索偏向 bug-track**
   - knowledge-track 文档会被低估，因为旧版本根本不把 `applies_when` 当成强匹配信号

2. **伪阻断**
   - agent 会把一个当前仓库根本不存在的 `critical-patterns.md` 当成必须读取项
   - 这会让调用链在语义上保留一个不存在的前置要求

### 5.2 微观层面

微观上，影响体现在：

- Step 3b 是否允许 graceful skip
- Relevance scoring 是否能覆盖 knowledge-track
- 输出里的 `Critical Patterns` 段是“固定存在”还是“允许无此文件”
- `spec-plan` 等调用方拿到的摘要，是否真的能把当前仓库的 knowledge docs 纳入结果

因此，这不是文字优化，而是直接决定检索结果质量的行为差异。

## 6. 最优解判断

最优解是：**保留当前 `spec-first` 版本，不回退上游，并把这条分叉视为当前仓库的必要适配。**

判断依据：

1. 当前 `spec-compound` schema 已经是双轨结构，agent 必须跟着变
2. 当前仓库没有 `critical-patterns.md`，旧写法会产生错误前提
3. 当前测试契约已经明确要求 `critical-patterns` 可选和 `applies_when` 存在
4. 这个 agent 被多个核心 skill 复用，错误假设会沿公共链路放大

## 7. 吸收建议 / 保留分叉建议

### 建议保留

- 保留 `critical-patterns` 可选读取逻辑
- 保留 `applies_when` 相关字段与评分规则
- 保留 project-neutral 的 schema / planning 引用方式

### 对上游的反向吸收建议

- 如果未来要反向评估上游，当前 `spec-first` 的这组改动反而更像应被上游吸收的增强，而不是当前仓库的偏离

### 审查边界

本文只基于 agent 文本、当前仓库文件存在性、skill 调用链与测试契约做判断，未执行运行时测试。
