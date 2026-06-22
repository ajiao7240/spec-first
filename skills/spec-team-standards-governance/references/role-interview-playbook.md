# 角色访谈 Playbook

V2 interviews 用于填补 source code 和 configs 无法回答的缺口。不要为缺席角色补写答案；missing role input 应进入 open question 或 `not-run`，不能被推断成 policy。

## Intake 规则

- 将 interview 绑定到一个 `acquisition_id` 和一个 extraction target。
- 只把角色名记录为 owner roles，不记录 personal data。
- reusable standards 中不得包含 business、customer、incident 和 personnel details。
- 只有答案包含 scope、exceptions、source refs 或 explicit owner decision 时，才转换为 candidates。
- Interview notes 不是 confirmed standards；它们只是 `suggested` candidates 或 promotion proposals 的 evidence。

## 角色问题

### architecture owner

- 该 capability 的 business state transitions 由哪一层负责？
- 哪些 dependency directions 被禁止？
- 什么时候 implementation 前必须有 ADR 或 design note？
- 允许哪些 exceptions，由谁批准？

### security/privacy owner

- 哪些 data classes 进入 candidates 或 replay fixtures 前必须 redaction？
- 哪些 permission、auth、payment、funds 或 privacy flows 属于 high impact？
- 哪些 logs、traces 或 PR snippets 绝不能复制进 standards artifacts？
- 哪类 source 确认该 policy：config、ADR、compliance note 还是 owner decision？

### test/QA owner

- promotion 前哪些 regression cases 是 mandatory？
- 期望使用哪种 fixture style 或 integration boundary？
- 哪些 historical bugs 应转成 replay cases？

### SRE/operations owner

- 哪些 rollout、rollback、monitoring 或 alerting rules 约束该 slice？
- 哪些 incident evidence 可抽象成 reusable standards，且不会泄漏 sensitive details？

### App/H5/PC/Admin owner

- 哪些 UI/error/state semantics 必须跨 surface 保持一致？
- 哪些 surface-specific exception 是 deliberate，而不是 drift？
- 哪个 source 确认 cross-surface behavior？

### Backend/Data owner

- 哪些 API、event、idempotency 和 data lifecycle rules 适用？
- 哪些 storage 或 migration constraints 属于 high impact？

### product/business owner

- 哪些 user promises、compliance expectations 或 business-state meanings 会约束 engineering changes？
- 哪些 exceptions 需要 product 或 compliance approval？

## 输出形状

每条 interview note 应记录：

- `acquisition_id`
- `role`
- `status`: `answered`, `partial`, `not-run`
- `source_refs`
- `candidate_ids`
- `open_questions`
- `privacy_review`
- `next_action`
