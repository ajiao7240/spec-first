# spec-doc-review/security-lens-reviewer 映射方案分析

> Lifecycle: historical-input / external-reference. 本文保留历史 CRG/CE/ECC 方案、迁移或对比材料；其中 `src/crg`、`spec-first crg`、`graph.db`、`better-sqlite3`、`.claude-plugin`、`CRG Stage-0`、`ECC`、`compound-engineering-plugin`、命令数量和文件数量等旧口径可能已过期。当前 source of truth 以 `docs/archive-index.md`、`docs/README.md`、根目录 README、`docs/05-用户手册/`、`docs/contracts/`、`skills/`、`src/cli/`、`CHANGELOG.md`、`spec-mcp-setup` 和 `spec-graph-bootstrap` 为准。

## 1. 结论摘要

结论：`security-lens-reviewer` 的上游与当前 spec-first 实现没有功能性分歧，唯一差异仍是 frontmatter 中的 `model` 配置。上游为 `sonnet`，当前为 `inherit`。正文里的攻击面清单、鉴权/授权、数据暴露、第三方信任边界、密钥管理、计划级威胁建模全部一致。

判断：对 spec-first 当前项目，保留当前 `inherit` 更优，不建议为追平而把这类 reviewer 回退成固定模型。就代码事实而言，这不是安全能力缺失，而是运行策略差异。

## 2. 代码事实

- 源文件：`/Users/kuang/xiaobu/compound-engineering-plugin/plugins/compound-engineering/agents/spec-doc-review/security-lens-reviewer.md:1-36`
- 当前文件：`/Users/kuang/xiaobu/spec-first/agents/spec-doc-review/security-lens-reviewer.md:1-36`
- 上游第 4 行：`model: sonnet`
- 当前第 4 行：`model: inherit`
- 其余正文一致，包括：
  - `Attack surface inventory`
  - `Auth/authz gaps`
  - `Data exposure`
  - `Third-party trust boundaries`
  - `Secrets and credentials`
  - `Plan-level threat model`
  - `Confidence calibration`
  - `What you don't flag`

## 3. 上游实现解读

上游把这个 reviewer 定义为“计划级安全审查者”，而不是代码静态扫描器。它关注的是实现开始之前，计划文档是否已经显式识别安全相关决策与攻击面。

这份实现的特点很清晰：

- 不做泛泛安全口号，而是把检查点拆成可落地的 planning-level 条目
- 要求 reviewer 为没有安全考虑的攻击面逐项产出 finding
- 强调 `top 3 exploits` 的轻量 threat model，而不是要求完整威胁建模文档

这是一个边界清晰、工程实用的 reviewer 定义，没有看到上游在正文上继续增强。

## 4. 当前实现解读

当前 spec-first 版本完整保留了这套计划级安全审查框架，只在 frontmatter 中使用 `inherit` 替代 `sonnet`。宿主 `spec-doc-review` skill 对安全 lens 的激活条件也与这个 agent 的职责匹配：认证授权、外部 API、敏感数据、第三方集成等信号会触发它，见 `/Users/kuang/xiaobu/spec-first/.agents/skills/spec-doc-review/SKILL.md:38-42`。

因此，当前实现并没有丢失安全分析维度。

## 5. 差异细节与影响

唯一差异：

- 上游：`/Users/kuang/xiaobu/compound-engineering-plugin/plugins/compound-engineering/agents/spec-doc-review/security-lens-reviewer.md:4` 为 `model: sonnet`
- 当前：`/Users/kuang/xiaobu/spec-first/agents/spec-doc-review/security-lens-reviewer.md:4` 为 `model: inherit`

影响分析：

- 不影响 reviewer 的检查框架与输出边界
- 会影响由哪个模型执行相同提示词
- 仅从代码对比，无法证明上游固定 `sonnet` 会带来当前无法达到的计划级安全审查能力

## 6. 最优解判断

最优解是保留当前 spec-first 分叉，不吸收上游这处 `model` 配置。

理由：

- 当前能力文本与上游完全一致
- 没有发现安全审查逻辑的缺漏
- 在缺少“必须固定模型”的代码证据前，不应把运行策略差异误判为功能待追平项

## 7. 吸收建议 / 保留分叉建议

建议保留分叉，不做代码同步。

- 保留当前 `model: inherit`
- 不需要同步正文
- 若未来全项目统一 agent frontmatter 策略，再把它放到全局策略层面处理，而不是在该 reviewer 上单点回退

本分析仅基于静态代码对比，未运行任何测试，也未验证不同模型下的安全审查输出表现。
