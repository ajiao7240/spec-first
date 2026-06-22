# 来源矩阵

本 reference 定义 V2 规范获取中不同证据来源的默认 authority 边界。它只帮助解释候选来源，不决定 promotion。

| 来源类型 | 示例 | 默认最高 trust | 最高 authority tier | 候选类型 | 必要确认 |
| --- | --- | --- | --- | --- | --- |
| `explicit-doc` | `AGENTS.md`、`CLAUDE.md`、README、architecture docs、design notes | `suggested` 或 `confirmed-draft` proposal | `explicit-authority` | `explicit-rule`, `promotion-proposal` | active source-edit workflow、diff review、owner/high-impact check |
| `machine-enforced-config` | lint、formatter、schema、CI、test command config | `suggested` 或 `confirmed-draft` proposal | `machine-enforced-policy` | `explicit-rule`, `promotion-proposal` | 当前 config source，且无语义扩展 |
| `code-structure` | current source layout、dependency direction、test layout | `observed` | `inferred-from-code` | `observed-pattern` | promotion 前需要 source confirmation 加 owner/design note |
| `project-graph` | graphify/codegraph candidate paths | `observed` | 带 `provider_untrusted` 的 `inferred-from-code` | `observed-pattern` | 从当前 source/test/doc/log evidence 复核 |
| `pr-review` | repeated review comments、accepted reviewer feedback | `suggested` | `repeated-review-or-incident` | `suggested-rule` | replay case refs 加 owner 或 reviewer consensus |
| `incident` | postmortem、bug replay、production issue analysis | `suggested` | `repeated-review-or-incident` 或 `high-impact-governance` | `suggested-rule`, `conflict-record` | high impact 需要 privacy review 和 owner gate |
| `tests` | fixtures、regression tests、contract tests | `observed` 或 `suggested` | 被机械 enforce 时为 `machine-enforced-policy` | `observed-pattern`, `promotion-proposal` | test source 和 scope validation |
| `interview` | role owner answers 和 owner decisions | `suggested` 或 `confirmed-draft` proposal | 决策明确时才是 `explicit-authority` | `suggested-rule`, `promotion-proposal` | source refs、scope、privacy review 和 role 形式的 owner identity |
| `docs-solutions` | reusable lessons 和 prior debugging docs | `suggested` | `repeated-review-or-incident` | `suggested-rule` | 当前 source 复核 |

代码结构不能单独产生 `confirmed` trust。`provider_untrusted` facts 可以帮助确定检查优先级，但在存在当前 source anchor 前不能作为 promotion evidence。

## Promotion 说明

- `confidence_score` 和 evidence quality scores 是输入，不是 authority。
- `multi-source-high-confidence` 可以准备 promotion proposal，但 confirmed writes 仍需要 source-edit workflow 和 review。
- `conflict-present` 在冲突解决前总是暂停 promotion。
- High-impact governance 即使证据质量高，也要走 owner/ADR/design-note handling。
