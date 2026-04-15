# spec-work Stage-0 消费验证记录

> 时点说明（2026-04-14 补充）：本记录反映的是 2026-04-13 当时的人工消费验证结果，用于证明阶段 3A 准入已成立。当前仓库头状态下，`docs/contexts/spec-first/injection-index.yaml` 与 `tests/unit/spec-graph-bootstrap-contracts.test.js` 已进一步收敛，`work` 不再允许通过 stage block 直接重复注入 `code-facts/public-entrypoints.md`。因此若正文存在与当前头状态不一致之处，应按“历史时点记录”理解，而不应视为当前缺陷。

- 日期：2026-04-13
- workflow：`spec-work`
- 验证目标：确认 Stage-0 产物可被 work 阶段稳定人工消费，并形成进入 3B 的最小规则集
- verdict：`pass`
- allow_enter_3b：`yes`

## 1. 预期输入

- `docs/contexts/spec-first/README.md`
- `docs/contexts/spec-first/00-summary.md`
- `docs/contexts/spec-first/code-facts/test-map.md`
- `docs/contexts/spec-first/code-facts/public-entrypoints.md`
- `docs/contexts/spec-first/injection-index.yaml`

## 2. 实际输入

- 命中 `always[]`：`00-summary.md`、`README.md`
- 命中 `stages.work[]`：`code-facts/test-map.md`
- 命中 `selection_rules(output_exists.code_facts_public_entrypoints)`：`code-facts/public-entrypoints.md`

## 3. fallback 验证

- `injection-index.yaml` 缺失时，能够降级到固定最小集合继续运行
- `docs/contexts/spec-first/` 缺失时，不阻断主任务，仅跳过 Stage-0 预载

## 4. 结论

- `spec-work` 已能人工消费 Stage-0 产物
- v1 最小消费顺序成立：`always[] -> stages.work[] -> selection_rules(output_exists.*) -> advice.work`
- 缺失即降级、不阻断主任务的规则成立
