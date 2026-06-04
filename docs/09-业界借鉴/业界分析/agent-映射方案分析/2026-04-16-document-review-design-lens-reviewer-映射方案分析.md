# spec-doc-review/design-lens-reviewer 映射方案分析

> Lifecycle: historical-input / external-reference. 本文保留历史 CRG/CE/ECC 方案、迁移或对比材料；其中 `src/crg`、`spec-first crg`、`graph.db`、`better-sqlite3`、`.claude-plugin`、`CRG Stage-0`、`ECC`、`compound-engineering-plugin`、命令数量和文件数量等旧口径可能已过期。当前 source of truth 以 `docs/archive-index.md`、`docs/README.md`、根目录 README、`docs/05-用户手册/`、`docs/contracts/`、`skills/`、`src/cli/`、`CHANGELOG.md`、`spec-mcp-setup` 和 `spec-graph-bootstrap` 为准。

## 1. 结论摘要

结论：这组映射的真实差异只有一处，即 frontmatter 中的 `model` 配置。上游将 reviewer 固定为 `sonnet`，当前 spec-first 将其改为 `inherit`。从这两个仓库现有代码事实看，`design-lens-reviewer` 的审查语义、维度、置信度规则、边界约束完全一致，因此这不是能力缺口，而是运行时模型选择策略分叉。

判断：对 spec-first 当前体系，保留 `model: inherit` 更优，不建议回退到上游的固定 `sonnet`。理由不是“更先进”，而是当前文件已经表明 spec-first 在这个 reviewer 上选择了继承式模型策略，而未看到任何代码事实证明该 reviewer 依赖某个固定模型才成立。

## 2. 代码事实

- 源文件：`/Users/kuang/xiaobu/compound-engineering-plugin/plugins/compound-engineering/agents/spec-doc-review/design-lens-reviewer.md:1-44`
- 当前文件：`/Users/kuang/xiaobu/spec-first/agents/spec-doc-review/design-lens-reviewer.md:1-44`
- 上游第 4 行为 `model: sonnet`
- 当前第 4 行为 `model: inherit`
- 除第 4 行外，两端正文一致，包括：
  - 设计维度评分法：信息架构、交互状态、用户流、响应式/无障碍、未决设计决策
  - `AI slop check` 条目
  - `Confidence calibration`
  - `What you don't flag`

## 3. 上游实现解读

上游实现将 `design-lens-reviewer` 定义为一个偏“产品设计缺口审计”的 reviewer，而不是视觉设计师。它重点检查计划文档是否已经把实现会卡住的设计决策说清楚，避免执行者在实现阶段被迫猜测交互。

从代码看，上游的关键机制有三层：

- 用五个固定维度做评分式审查，要求仅输出 `7/10` 及以下的 findings。
- 单独增加 `AI slop check`，主动拦截模板化 SaaS 界面描述。
- 用 `What you don't flag` 限定边界，明确不越权到安全、后端、业务战略。

这说明上游把它设计成“文档阶段设计可实施性 reviewer”，而不是开放式风格建议器。

## 4. 当前实现解读

当前 spec-first 版本保留了上游的完整审查协议，只把 frontmatter 的模型从 `sonnet` 改为 `inherit`。也就是说，当前仓库没有削弱该 agent 的提示词能力边界，也没有调整设计维度定义。

结合宿主 skill 看，当前 `spec-doc-review` 会在检测到 UI/UX、页面、交互、无障碍等信号时启用该 agent，见 `/Users/kuang/xiaobu/spec-first/.agents/skills/spec-doc-review/SKILL.md:32-36`。因此，spec-first 当前的差异不是“少做了什么设计审查”，而是“由谁来执行同一套审查提示词”。

## 5. 差异细节与影响

唯一差异：

- 上游：`/Users/kuang/xiaobu/compound-engineering-plugin/plugins/compound-engineering/agents/spec-doc-review/design-lens-reviewer.md:4` 为 `model: sonnet`
- 当前：`/Users/kuang/xiaobu/spec-first/agents/spec-doc-review/design-lens-reviewer.md:4` 为 `model: inherit`

影响分析：

- 从提示词能力看：未见差异。两端的审查维度与输出约束一致。
- 从运行策略看：存在差异。上游把模型能力假定为固定依赖；当前把模型选择交给外层环境或宿主框架。
- 从 spec-first 的集成风险看：若回退为 `sonnet`，会把当前 reviewer 从“继承项目运行时模型策略”改回“单点硬编码模型策略”。仅基于现有代码，没有证据表明这样做能补足任何缺失能力。

## 6. 最优解判断

最优解是保留当前 spec-first 的实现，不吸收上游这处改动。

依据：

- 当前 reviewer 主体能力未落后，只有模型声明不同。
- 代码中没有发现该 reviewer 依赖 `sonnet` 才能成立的特殊提示结构、tool 约束或输出 schema。
- 在 spec-first 当前体系中，`inherit` 更符合“同一 agent 提示词可复用到不同运行宿主”的策略方向。这里是基于文件事实作出的工程判断，不是对效果的主观假设。

## 7. 吸收建议 / 保留分叉建议

建议保留分叉，不做代码同步。

- 保留当前 `model: inherit`
- 不需要从上游回抄正文，因为正文已一致
- 后续若要统一策略，应在 `spec-doc-review` 这组 reviewer 层面整体决策“哪些 reviewer 必须固定模型”，而不是单独回退这个文件

本分析仅基于静态代码对比，未运行任何测试，也未对实际 reviewer 输出质量做实测验证。
