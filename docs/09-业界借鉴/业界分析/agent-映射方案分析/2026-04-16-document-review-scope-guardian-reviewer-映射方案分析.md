# spec-doc-review/scope-guardian-reviewer 映射方案分析

> Lifecycle: historical-input / external-reference. 本文保留历史 CRG/CE/ECC 方案、迁移或对比材料；其中 `src/crg`、`spec-first crg`、`graph.db`、`better-sqlite3`、`.claude-plugin`、`CRG Stage-0`、`ECC`、`compound-engineering-plugin`、命令数量和文件数量等旧口径可能已过期。当前 source of truth 以 `docs/archive-index.md`、`docs/README.md`、根目录 README、`docs/05-用户手册/`、`docs/contracts/`、`skills/`、`src/cli/`、`CHANGELOG.md`、`spec-mcp-setup` 和 `spec-graph-bootstrap` 为准。

## 1. 结论摘要

结论：`scope-guardian-reviewer` 在上游与当前 spec-first 之间没有功能性差异，唯一差异仍然是 frontmatter 的 `model` 设置。上游固定为 `sonnet`，当前为 `inherit`。正文中的范围控制、复杂度挑战、优先级依赖、完整性原则等条目完全一致。

判断：对 spec-first 当前项目，保留 `inherit` 是更优解，不建议为了对齐上游而改回 `sonnet`。从代码事实看，这个 agent 的审查能力并未落后，上游也没有提供新的范围治理逻辑。

## 2. 代码事实

- 源文件：`/Users/kuang/xiaobu/compound-engineering-plugin/plugins/compound-engineering/agents/spec-doc-review/scope-guardian-reviewer.md:1-52`
- 当前文件：`/Users/kuang/xiaobu/spec-first/agents/spec-doc-review/scope-guardian-reviewer.md:1-52`
- 上游第 4 行：`model: sonnet`
- 当前第 4 行：`model: inherit`
- 从第 7 行开始到文末，正文一致，包括：
  - `"What already exists?"` 优先检查
  - `Scope-goal alignment`
  - `Complexity challenge`
  - `Priority dependency analysis`
  - `Completeness principle`

## 3. 上游实现解读

上游把 `scope-guardian-reviewer` 定义成一个“范围与抽象治理” reviewer，而不是普通的砍需求角色。其关键不是简单压缩 scope，而是持续追问两件事：

- 目标是否值得当前这组范围
- 每个抽象层是否真正有现实收益

从正文可见，它特别强调：

- 先查现有代码、库、基础设施是否已能解决问题
- 对新增抽象、插件化、配置化、框架化倾向保持高敏感
- 在 AI 降低实现成本的前提下，不鼓励“为了省事只做一半”的伪简化

这套定义本身较成熟，没有看到上游继续扩展的新规则。

## 4. 当前实现解读

当前 spec-first 实现与上游正文一致，说明当前仓库已经完整吸收了该 reviewer 的范围治理方法。它和当前宿主 `spec-doc-review` skill 的启用条件也保持一致性：当文档出现多优先级、大量需求、stretch goals、范围边界模糊等信号时启用，见 `/Users/kuang/xiaobu/spec-first/.agents/skills/spec-doc-review/SKILL.md:44-49`。

因此，当前实现不是能力缺失，而是模型调度策略不同。

## 5. 差异细节与影响

唯一差异：

- 上游：`/Users/kuang/xiaobu/compound-engineering-plugin/plugins/compound-engineering/agents/spec-doc-review/scope-guardian-reviewer.md:4` 为 `model: sonnet`
- 当前：`/Users/kuang/xiaobu/spec-first/agents/spec-doc-review/scope-guardian-reviewer.md:4` 为 `model: inherit`

影响分析：

- 不影响审查协议本身，因为正文无差异
- 影响运行时模型选择方式：上游倾向固定模型，当前倾向由宿主继承
- 就这份 agent 自身，没有证据表明固定 `sonnet` 会带来必须保留的额外能力

## 6. 最优解判断

最优解是维持当前 spec-first 版本，不吸收上游的 `model: sonnet`。

依据：

- 主体提示词已完全一致，没有待补能力
- 当前分叉是模型选择策略，不是逻辑缺口
- 在未见必须固定模型的代码证据前，把 `inherit` 改回 `sonnet` 只会增加策略分叉的复杂度，不会补齐功能

## 7. 吸收建议 / 保留分叉建议

建议保留分叉，不做代码同步。

- 保留当前 `model: inherit`
- 不需要同步正文，因为正文已完全对齐
- 若未来 spec-doc-review 全组 reviewer 要统一模型策略，应整组评估，而不是单改此文件

本分析仅基于静态代码对比，未运行任何测试，也未实测不同模型配置下的 reviewer 输出差异。
