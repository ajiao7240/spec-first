# 来源矩阵

`acquisition_id: team-standards-v2-pilot-20260623`

本矩阵记录当前 V2 pilot 允许消费的来源类型和默认 authority 边界。它用于候选生成和 evidence ledger，不是 confirmed standards source。

| 来源类型 | 本次是否使用 | 默认最高 trust | 最高 authority tier | 候选类型 | 必要确认 |
| --- | --- | --- | --- | --- | --- |
| `explicit-doc` | yes | `suggested` / `confirmed-draft` proposal | `explicit-authority` | `suggested-rule`, `promotion-proposal` | source-edit workflow + diff review |
| `contract` | yes | `suggested` / `confirmed-draft` proposal | `explicit-authority` | `promotion-proposal` | contract tests + review |
| `skill-source` | yes | `suggested` | `explicit-authority` | `suggested-rule` | skill contract tests |
| `machine-enforced-config` | no | `suggested` | `machine-enforced-policy` | `promotion-proposal` | 当前 config source |
| `code-structure` | no | `observed` | `inferred-from-code` | `observed-pattern` | source 复核 + owner/design note |
| `project-graph` | no | `observed` | `inferred-from-code` + `provider_untrusted` | `observed-pattern` | 当前 source/test/doc evidence |
| `pr-review` | no | `suggested` | `repeated-review-or-incident` | `suggested-rule` | replay refs + owner/reviewer consensus |
| `incident` | no | `suggested` | `repeated-review-or-incident` / `high-impact-governance` | `suggested-rule`, `conflict-record` | privacy review + owner gate |
| `interview` | no | `suggested` / `confirmed-draft` proposal | 决策明确时为 `explicit-authority` | `promotion-proposal` | role owner answer + source refs |
| `docs-solutions` | no | `suggested` | `repeated-review-or-incident` | `suggested-rule` | 当前 source 复核 |

代码结构不能单独产生 `confirmed` trust。Graph/code evidence 在被当前 source、tests、docs、logs 或 config 复核前都是 `provider_untrusted`。
