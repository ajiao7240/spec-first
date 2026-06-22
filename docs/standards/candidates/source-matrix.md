# Source Matrix

`acquisition_id: team-standards-v2-pilot-20260623`

本矩阵记录当前 V2 pilot 允许消费的来源类型和默认 authority 边界。它用于候选生成和 evidence ledger，不是 confirmed standards source。

| Source type | 本次是否使用 | Max default trust | Max authority tier | Candidate type | Required confirmation |
| --- | --- | --- | --- | --- | --- |
| `explicit-doc` | yes | `suggested` / `confirmed-draft` proposal | `explicit-authority` | `suggested-rule`, `promotion-proposal` | source-edit workflow + diff review |
| `contract` | yes | `suggested` / `confirmed-draft` proposal | `explicit-authority` | `promotion-proposal` | contract tests + review |
| `skill-source` | yes | `suggested` | `explicit-authority` | `suggested-rule` | skill contract tests |
| `machine-enforced-config` | no | `suggested` | `machine-enforced-policy` | `promotion-proposal` | current config source |
| `code-structure` | no | `observed` | `inferred-from-code` | `observed-pattern` | source reconfirmation + owner/design note |
| `project-graph` | no | `observed` | `inferred-from-code` + `provider_untrusted` | `observed-pattern` | current source/test/doc evidence |
| `pr-review` | no | `suggested` | `repeated-review-or-incident` | `suggested-rule` | replay refs + owner/reviewer consensus |
| `incident` | no | `suggested` | `repeated-review-or-incident` / `high-impact-governance` | `suggested-rule`, `conflict-record` | privacy review + owner gate |
| `interview` | no | `suggested` / `confirmed-draft` proposal | `explicit-authority` when decision is explicit | `promotion-proposal` | role owner answer + source refs |
| `docs-solutions` | no | `suggested` | `repeated-review-or-incident` | `suggested-rule` | current source reconfirmation |

代码结构不能单独产生 `confirmed` trust；code structure cannot produce `confirmed` by itself. Graph/code evidence is `provider_untrusted` until reconfirmed from current source, tests, docs, logs or config.
