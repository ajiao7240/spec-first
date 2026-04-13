# 3A 验证记录：spec-work Stage-0 消费

- task_name: `spec-work` 消费 `spec-graph-bootstrap` Stage-0 产物，执行阶段 3B 的最小侵入式接入修改
- task_goal: 验证 `work` 阶段是否能依靠 `always + stages.work + output_exists.*` 在实施前获得入口与测试面信息，而不强依赖专用 task pack
- stage: `work`
- task_type: `unknown`
- context_slug: `spec-first`
- expected_inputs:
  - `docs/contexts/spec-first/00-summary.md`
  - `docs/contexts/spec-first/README.md`
  - `docs/contexts/spec-first/code-facts/public-entrypoints.md`
  - `docs/contexts/spec-first/code-facts/test-map.md`
- actual_inputs:
  - `docs/contexts/spec-first/00-summary.md`
  - `docs/contexts/spec-first/README.md`
  - `docs/contexts/spec-first/code-facts/public-entrypoints.md`
  - `docs/contexts/spec-first/code-facts/test-map.md`
- fallback_triggered: `no`
- fallback_reason: `none`
- degrade_level: `none`
- missing_outputs: `[]`
- misleading_points:
  - `advice.work` 仍保留了“优先 context-packs 和 test-map”的文字，但当前 v1 的 `stages.work` 已不再引入 `context-packs/*`；这是优先级提示与实际最小集合之间的轻微张力，需要消费端按 yaml 实际列表执行
  - `output_exists.*` 追加的 `public-entrypoints.md` 与 `stages.work` 自带项重复，需做去重
- useful_outputs:
  - `code-facts/public-entrypoints.md` 帮助快速锁定需要修改的 skill/CLI 边界与核心入口
  - `code-facts/test-map.md` 提醒本次改动更适合做文本级验证与 smoke/integration 影响判断，而非盲目扩大测试面
  - `00-summary.md` 帮助确认这是 CLI/skill 治理类变更，保持最小入侵
- verdict: `pass`
- allow_enter_3b: `yes`
- gate_reason: `work` 阶段主路径成立，消费结果可直接支持“改哪几个 skill、验证哪些文本契约”；未触发 fallback，且已知弱点仅为提示语与去重细节，可解释且不影响实施判断

## 验证结论

本次验证证明 `spec-work` 在 v1 可以只依赖 code-facts 与固定 stage 路由获得足够的实施上下文，满足进入 3B 的最低要求。
