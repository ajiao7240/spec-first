# 输出风险画像

`acquisition_id: team-standards-v2-pilot-20260623`

## Run 级风险

| 风险 | 状态 | Reason code | 动作 |
| --- | --- | --- | --- |
| replay sample 缺失 | present | `not-enough-sample` | 不声明 PR replay pass。 |
| owner interview 缺失 | present | `not-run` | owner edit distance 保持 `not-run`。 |
| confirmed write 尝试 | absent | `source-edit-scope-clean` | 未写入 confirmed/index/archive。 |
| privacy leak | absent | `prewrite-hygiene-pass` | closeout 前运行 hygiene script。 |
| local absolute path | absent | `path-hygiene-pass` | 使用 repo-relative source anchors。 |
| prompt override text | absent | `prompt-hygiene-pass` | rule text 仅作为 data payload。 |

## 被抑制的输出

- 因为没有 replay sample set，未输出 PR replay result。
- 没有为缺席 owner 编造 role interview answer。
- 没有生成 confirmed standards patch。
- 没有编辑 generated runtime mirror。

## 局限

- 本 pilot 只验证 `shared/team-standards` slice 的 acquisition output shape。
- 它不证明 review false positives 已减少。
- 它不包含 owner edit distance。
- 它不包含 app/backend/data surface-specific standards。
