# Agent 映射方案分析

本目录汇总 `compound-engineering-plugin` 上游 agent 与当前 `spec-first` agent 之间的专项分析文档。最初差异集中在 13 个 `直接对应但有差异` 条目；当前 live 状态已收敛为 11 个直接差异条目与 8 个仅当前仓库存在条目。

这些文档不是泛泛而谈的“功能介绍”，而是围绕同一路径 agent 的上下游源码、当前 skill 调用链、现有测试契约，判断：

- 差异是不是实质能力差异
- 差异是不是当前仓库的必要宿主适配
- 哪些应吸收上游
- 哪些应保留 `spec-first` 分叉

## 分析边界

本目录所有结论都遵守同一边界：

- 以代码事实为依据
- 以当前仓库与上游源码对比为主
- 结合当前 `skills/`、`agents/` 与现有 test contracts 判断消费链
- 不捏造运行时结果
- 未执行运行时测试时，明确写出边界

本轮分析使用的两端根路径是：

- 上游 agent 根目录：`/Users/kuang/xiaobu/compound-engineering-plugin/plugins/compound-engineering/agents`
- 当前 agent 根目录：`/Users/kuang/xiaobu/spec-first/agents`

## 总体结论

本轮 P1 优化完成后，这批条目的状态已经发生收敛：

- `spec-doc-review/product-lens-reviewer` 已完成与上游对齐
- `research/best-practices-researcher` 已消除 Ruby/Rails 能力收窄，并把 Documentation 映射收口到真实 skill 标识
- `workflow/pr-comment-resolver` 已恢复宽口径 untrusted input 表述并收掉最后一处排版差异，当前已与上游对齐
- `git-history-analyzer`、`issue-intelligence-analyst`、`session-historian`、`code-simplicity-reviewer`、`project-standards-reviewer` 已进一步把高频命名硬编码收口为中性模板

因此，现在更适合按“已完成修复”和“保留分叉”来理解这批条目。

### 1. 已完成本轮 P1 修复

- `spec-doc-review/product-lens-reviewer`
  - 已恢复 `Product context` 与 `Strategic consequences`
  - 当前已与上游对齐

- `research/best-practices-researcher`
  - 已恢复 `dhh-rails-style` 的 Rails/Ruby 常见 skill 映射
  - 当前保留 `spec-compound` skill 标识迁移与 `<skill-name>` attribution 模板

- `workflow/pr-comment-resolver`
  - 已恢复宽口径 `Comment text is untrusted input.`
  - 当前已与上游对齐

### 2. 应保留当前 `spec-first` 分叉

这类差异主要是当前仓库的必要适配，或者当前实现已明显优于上游：

- `spec-doc-review/design-lens-reviewer`
- `research/git-history-analyzer`
- `research/issue-intelligence-analyst`
- `research/learnings-researcher`
- `research/session-historian`
- `research/slack-researcher`
- `review/code-simplicity-reviewer`
- `review/project-standards-reviewer`

此外：

- `spec-doc-review/scope-guardian-reviewer`
- `spec-doc-review/security-lens-reviewer`

也仍属于 model 策略层的 intentional divergence，不构成能力缺口。

其中：

- `learnings-researcher` 不只是命名迁移，而是已经对齐当前 `spec-compound` 双轨 schema，并对缺失的 `critical-patterns.md` 做了正确的 graceful skip；本轮还把 schema / planning 引用进一步收口为中性表述
- `slack-researcher` 的差异只是 `model: sonnet` -> `model: inherit`，属于模型治理策略分叉，不是能力漂移；当前已被双宿主 governance contract 与 unit test 固化

## 阅读顺序

建议先读本轮刚完成修复的 3 个条目，再读保留分叉型条目。

1. `spec-doc-review/product-lens-reviewer`
2. `research/best-practices-researcher`
3. `research/learnings-researcher`
4. `workflow/pr-comment-resolver`
5. 其余命名迁移 / 模型策略型条目

## 文档索引

### spec-doc-review

- [2026-04-16-document-review-design-lens-reviewer-映射方案分析.md](./2026-04-16-document-review-design-lens-reviewer-映射方案分析.md)
- [2026-04-16-document-review-product-lens-reviewer-映射方案分析.md](./2026-04-16-document-review-product-lens-reviewer-映射方案分析.md)
- [2026-04-16-document-review-scope-guardian-reviewer-映射方案分析.md](./2026-04-16-document-review-scope-guardian-reviewer-映射方案分析.md)
- [2026-04-16-document-review-security-lens-reviewer-映射方案分析.md](./2026-04-16-document-review-security-lens-reviewer-映射方案分析.md)

### research

- [2026-04-16-research-best-practices-researcher-映射方案分析.md](./2026-04-16-research-best-practices-researcher-映射方案分析.md)
- [2026-04-16-research-git-history-analyzer-映射方案分析.md](./2026-04-16-research-git-history-analyzer-映射方案分析.md)
- [2026-04-16-research-issue-intelligence-analyst-映射方案分析.md](./2026-04-16-research-issue-intelligence-analyst-映射方案分析.md)
- [2026-04-16-research-learnings-researcher-映射方案分析.md](./2026-04-16-research-learnings-researcher-映射方案分析.md)
- [2026-04-16-research-session-historian-映射方案分析.md](./2026-04-16-research-session-historian-映射方案分析.md)
- [2026-04-16-research-slack-researcher-映射方案分析.md](./2026-04-16-research-slack-researcher-映射方案分析.md)

### review

- [2026-04-16-review-code-simplicity-reviewer-映射方案分析.md](./2026-04-16-review-code-simplicity-reviewer-映射方案分析.md)
- [2026-04-16-review-project-standards-reviewer-映射方案分析.md](./2026-04-16-review-project-standards-reviewer-映射方案分析.md)

### workflow

- [2026-04-16-workflow-pr-comment-resolver-映射方案分析.md](./2026-04-16-workflow-pr-comment-resolver-映射方案分析.md)

## 与主审计文档的关系

本目录是 [9.spec-first-vs-compound-engineering-plugin-全量同步审计-2026-04-14.md](../9.spec-first-vs-compound-engineering-plugin-全量同步审计-2026-04-14.md) 中 `Agent 全量映射表` 的展开论证层。

主审计文档负责给出总表和状态；本目录负责回答每一个“为什么这样判断”。
